require('dotenv').config();

const dns = require('node:dns');
// Use public DNS to ensure MongoDB Atlas SRV resolution works reliably across network setups
try {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch (e) {
  // If restricted, fallback to default system DNS
}

const express = require('express');
const cors = require('cors');
const fs = require('node:fs');
const path = require('node:path');
const multer = require('multer');
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const port = Number(process.env.PORT) || 3000;
const mongoUri = process.env.MONGODB_URI;
const databaseName = process.env.MONGODB_DB_NAME || 'itproflms';
const jwtSecret = process.env.JWT_SECRET || 'itproflms_jwt_secret_fallback_2026';
const lessonUploadDirectory = path.join(__dirname, 'uploads', 'lessons');
fs.mkdirSync(lessonUploadDirectory, { recursive: true });
const lessonUpload = multer({
  storage: multer.diskStorage({
    destination: lessonUploadDirectory,
    filename: (req, file, callback) => {
      const safeName = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_');
      callback(null, `${Date.now()}-${safeName}`);
    }
  }),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    if (!['.pdf', '.pptx'].includes(extension)) {
      return callback(new Error('Only PDF and PPTX files are supported.'));
    }
    callback(null, true);
  }
});

if (!mongoUri) {
  throw new Error('MONGODB_URI is required in environment variables');
}

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads/lessons', express.static(lessonUploadDirectory));

// Request logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

const mongoClient = new MongoClient(mongoUri);
let database;
let usersCollection;
let subjectsCollection;
let enrollmentsCollection;
let assignmentsCollection;
let lessonsCollection;
let studentsCollection;
let facultyCollection;
let programChairsCollection;
let programsCollection;
let coursesCollection;
let sectionsCollection;

// Authentication Middleware for protected routes
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, jwtSecret, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = decoded;
    next();
  });
}

function requireSuperAdmin(req, res, next) {
  if (req.user.role !== 'super_admin' && req.user.role !== 'super admin') {
    return res.status(403).json({ error: 'Super admin access required' });
  }

  next();
}

function requireProgramChair(req, res, next) {
  if (req.user.role !== 'program_chair') {
    return res.status(403).json({ error: 'Program chair access required' });
  }
  next();
}

function requireStudent(req, res, next) {
  if (req.user.role !== 'student') {
    return res.status(403).json({ error: 'Student access required' });
  }
  next();
}

function requireTeachingStaff(req, res, next) {
  if (!['faculty', 'instructor', 'program_chair'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Faculty or program chair access required.' });
  }
  next();
}

function serializeLesson(lesson) {
  return {
    id: lesson._id.toString(),
    subjectId: lesson.subjectId.toString(),
    title: lesson.title,
    description: lesson.description || '',
    type: lesson.type,
    fileName: lesson.fileName || null,
    fileUrl: lesson.fileName ? `/uploads/lessons/${lesson.fileName}` : null,
    slides: lesson.slides || [],
    createdAt: lesson.createdAt,
    updatedAt: lesson.updatedAt
  };
}

// ----------------- ROUTES ----------------- //

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: database ? 'ok' : 'degraded',
    database: database ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

// Helper validation functions
function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@tup\.edu\.ph$/i.test(email.trim());
}

const VALID_YEAR_LEVELS = ['First Year', 'Second Year', 'Third Year', 'Fourth Year'];
const VALID_TERMS = ['First Term', 'Second Term', 'Third Term'];
// Public: Get all programs for registration dropdown
app.get('/api/programs', async (req, res) => {
  try {
    const programs = await programsCollection.find({}).sort({ name: 1 }).toArray();
    return res.json({
      programs: programs.map((p) => ({
        id: p._id.toString(),
        name: p.name
      }))
    });
  } catch (error) {
    console.error('Error fetching programs:', error);
    return res.status(500).json({ error: 'Failed to fetch programs.' });
  }
});

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, program, profilePictureBase64 } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({ error: 'Please enter a valid name (at least 2 characters).' });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Please use your TUP email address ending in @tup.edu.ph.' });
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    if (!program || typeof program !== 'string' || !program.trim()) {
      return res.status(400).json({ error: 'Program is required (e.g. BSIT, BSCS).' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if user already exists
    const existingUser = await usersCollection.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Build profile picture data URI if provided
    const profilePicture = profilePictureBase64
      ? `data:image/jpeg;base64,${profilePictureBase64}`
      : null;

    const newUser = {
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: 'student',
      program: program.trim(),
      profilePicture,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await usersCollection.insertOne(newUser);
    const userId = result.insertedId.toString();
    await studentsCollection.insertOne({
      userId: result.insertedId,
      yearLevel: null,
      sectionId: null,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Generate JWT
    const token = jwt.sign(
      {
        userId,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role
      },
      jwtSecret,
      { expiresIn: '7d' }
    );

    return res.status(201).json({
      message: 'Account created successfully',
      token,
      user: {
        id: userId,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        program: newUser.program,
        profilePicture: newUser.profilePicture,
        createdAt: newUser.createdAt
      }
    });
  } catch (error) {
    console.error('Error during registration:', error);
    // Handle MongoDB duplicate key error code 11000
    if (error.code === 11000) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }
    return res.status(500).json({ error: 'Internal server error while creating account.' });
  }
});

// Login

app.post('/api/auth/login', async (req, res) => {

  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Find user by email
    const user = await usersCollection.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const userId = user._id.toString();

    // Generate JWT
    const token = jwt.sign(
      {
        userId,
        email: user.email,
        name: user.name,
        role: user.role
      },
      jwtSecret,
      { expiresIn: '7d' }
    );

    return res.json({
      message: 'Login successful',
      token,
      user: {
        id: userId,
        name: user.name,
        email: user.email,
        role: user.role || 'student',
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Error during login:', error);
    return res.status(500).json({ error: 'Internal server error while logging in.' });
  }
});

// Get current authenticated user profile
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    let user;
    try {
      user = await usersCollection.findOne(
        { _id: new ObjectId(req.user.userId) },
        { projection: { password: 0 } }
      );
    } catch {
      user = await usersCollection.findOne(
        { email: req.user.email },
        { projection: { password: 0 } }
      );
    }

    if (!user) {
      return res.status(404).json({ error: 'User profile not found.' });
    }

    return res.json({
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role || 'student',
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return res.status(500).json({ error: 'Failed to fetch user profile.' });
  }
});

app.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
  try {
    const role = req.user.role === 'super admin' ? 'super_admin' : req.user.role;
    const [users, subjects, sections, enrollments, assignments] = await Promise.all([
      usersCollection.countDocuments({}),
      subjectsCollection.countDocuments({}),
      sectionsCollection.countDocuments({}),
      enrollmentsCollection.countDocuments({}),
      assignmentsCollection.countDocuments({})
    ]);

    if (role === 'student') {
      const studentId = new ObjectId(req.user.userId);
      const profile = await studentsCollection.findOne({ userId: studentId });
      const availableSubjects = profile?.yearLevel
        ? await subjectsCollection.find({ yearLevel: profile.yearLevel }).toArray()
        : [];
      const studentEnrollments = await enrollmentsCollection.find({ studentId }).toArray();
      const enrolledSubjectIds = studentEnrollments.map((item) => item.subjectId);
      const enrolledSubjects = enrolledSubjectIds.length
        ? await subjectsCollection.find({ _id: { $in: enrolledSubjectIds } }).toArray()
        : [];
      const terms = ['First Term', 'Second Term', 'Third Term'].map((term) => ({
        label: term.replace(' Term', ''),
        value: enrolledSubjects.filter((subject) => subject.term === term).length
      }));
      return res.json({
        role,
        chart: terms,
        totals: { availableSubjects: availableSubjects.length, enrolledSubjects: enrolledSubjects.length }
      });
    }

    if (role === 'faculty') {
      const facultyAssignments = await assignmentsCollection.countDocuments({
        facultyId: new ObjectId(req.user.userId)
      });
      return res.json({
        role,
        chart: [
          { label: 'Subjects', value: facultyAssignments },
          { label: 'Lessons', value: 0 },
          { label: 'Exams', value: 0 },
          { label: 'Grades', value: 0 }
        ],
        totals: { assignedSubjects: facultyAssignments }
      });
    }

    if (role === 'program_chair') {
      return res.json({
        role,
        chart: [
          { label: 'Subjects', value: subjects },
          { label: 'Sections', value: sections },
          { label: 'Assignments', value: assignments },
          { label: 'Enrollments', value: enrollments }
        ],
        totals: { subjects, sections, assignments, enrollments }
      });
    }

    return res.json({
      role,
      chart: [
        { label: 'Students', value: await usersCollection.countDocuments({ role: 'student' }) },
        { label: 'Faculty', value: await usersCollection.countDocuments({ role: { $in: ['faculty', 'instructor'] } }) },
        { label: 'Programs', value: await programsCollection.countDocuments({}) },
        { label: 'Subjects', value: subjects }
      ],
      totals: { users, subjects, sections, enrollments, assignments }
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return res.status(500).json({ error: 'Failed to fetch dashboard statistics.' });
  }
});

// Program chair subject and enrollment management
app.get('/api/program-chair/subjects', authenticateToken, requireProgramChair, async (req, res) => {
  try {
    const subjects = await subjectsCollection.find({}).sort({ code: 1 }).toArray();
    return res.json({ subjects });
  } catch (error) {
    console.error('Error fetching subjects:', error);
    return res.status(500).json({ error: 'Failed to fetch subjects.' });
  }
});

app.get('/api/program-chair/users', authenticateToken, requireProgramChair, async (req, res) => {
  try {
    const users = await usersCollection
      .find({}, { projection: { password: 0 } })
      .sort({ name: 1 })
      .toArray();
    return res.json({
      users: users.map((user) => ({
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role || 'student'
      }))
    });
  } catch (error) {
    console.error('Error fetching program chair users:', error);
    return res.status(500).json({ error: 'Failed to fetch users.' });
  }
});

app.get('/api/program-chair/students', authenticateToken, requireProgramChair, async (req, res) => {
  try {
    const students = await usersCollection.find({ role: 'student' }, { projection: { password: 0 } }).sort({ name: 1 }).toArray();
    const profiles = await studentsCollection.find({ userId: { $in: students.map((student) => student._id) } }).toArray();
    const profileByUserId = new Map(profiles.map((profile) => [profile.userId.toString(), profile]));
    return res.json({
      students: students.map((student) => {
        const profile = profileByUserId.get(student._id.toString());
        return {
          id: student._id.toString(),
          name: student.name,
          email: student.email,
          yearLevel: profile?.yearLevel || null,
          sectionId: profile?.sectionId?.toString() || null
        };
      })
    });
  } catch (error) {
    console.error('Error fetching program chair students:', error);
    return res.status(500).json({ error: 'Failed to fetch students.' });
  }
});

app.get('/api/program-chair/sections', authenticateToken, requireProgramChair, async (req, res) => {
  try {
    const sections = await sectionsCollection.find({}).sort({ name: 1 }).toArray();
    return res.json({ sections });
  } catch (error) {
    console.error('Error fetching sections:', error);
    return res.status(500).json({ error: 'Failed to fetch sections.' });
  }
});

// Program chair academic management (sections)
app.get('/api/program-chair/academic', authenticateToken, requireProgramChair, async (req, res) => {
  try {
    const [programs, sections] = await Promise.all([
      programsCollection.find({}).sort({ name: 1 }).toArray(),
      sectionsCollection.find({}).sort({ name: 1 }).toArray()
    ]);
    return res.json({ programs, sections });
  } catch (error) {
    console.error('Error fetching program chair academic data:', error);
    return res.status(500).json({ error: 'Failed to fetch academic data.' });
  }
});

app.post('/api/program-chair/sections', authenticateToken, requireProgramChair, async (req, res) => {
  const { name, yearLevel, programId, courseId } = req.body;
  const targetProgramId = programId || courseId;
  const VALID_YEAR_LEVELS = ['First Year', 'Second Year', 'Third Year', 'Fourth Year'];
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Section name is required.' });
  }
  if (!yearLevel || !VALID_YEAR_LEVELS.includes(yearLevel)) {
    return res.status(400).json({ error: `Year level must be one of: ${VALID_YEAR_LEVELS.join(', ')}.` });
  }
  if (!targetProgramId || !ObjectId.isValid(targetProgramId)) {
    return res.status(400).json({ error: 'A valid program is required.' });
  }
  let prog = await programsCollection.findOne({ _id: new ObjectId(targetProgramId) });
  if (!prog) {
    prog = await coursesCollection.findOne({ _id: new ObjectId(targetProgramId) });
  }
  if (!prog) return res.status(404).json({ error: 'Program not found.' });
  try {
    const result = await sectionsCollection.insertOne({
      name: name.trim(),
      yearLevel: yearLevel.trim(),
      programId: new ObjectId(targetProgramId),
      courseId: new ObjectId(targetProgramId),
      programName: prog.name,
      createdBy: req.user.userId,
      createdAt: new Date()
    });
    return res.status(201).json({
      section: {
        id: result.insertedId.toString(),
        name: name.trim(),
        yearLevel: yearLevel.trim(),
        programId: targetProgramId,
        programName: prog.name
      }
    });
  } catch (error) {
    console.error('Error creating section:', error);
    return res.status(error.code === 11000 ? 409 : 500).json({ error: 'Failed to create section.' });
  }
});

app.patch('/api/program-chair/sections/:sectionId', authenticateToken, requireProgramChair, async (req, res) => {
  try {
    const { name, yearLevel, programId, courseId } = req.body;
    const targetProgramId = programId || courseId;
    if (!ObjectId.isValid(req.params.sectionId) || !name?.trim() || !VALID_YEAR_LEVELS.includes(yearLevel) || !ObjectId.isValid(targetProgramId)) {
      return res.status(400).json({ error: 'Valid section name, year level, and program are required.' });
    }
    const program = await programsCollection.findOne({ _id: new ObjectId(targetProgramId) })
      || await coursesCollection.findOne({ _id: new ObjectId(targetProgramId) });
    if (!program) return res.status(404).json({ error: 'Program not found.' });
    const result = await sectionsCollection.findOneAndUpdate(
      { _id: new ObjectId(req.params.sectionId) },
      {
        $set: {
          name: name.trim(),
          yearLevel,
          programId: new ObjectId(targetProgramId),
          courseId: new ObjectId(targetProgramId),
          programName: program.name,
          updatedAt: new Date()
        }
      },
      { returnDocument: 'after' }
    );
    if (!result) return res.status(404).json({ error: 'Section not found.' });
    return res.json({ section: { ...result, id: result._id.toString() } });
  } catch (error) {
    console.error('Error updating section:', error);
    return res.status(error.code === 11000 ? 409 : 500).json({ error: error.code === 11000 ? 'A section with these details already exists.' : 'Failed to update section.' });
  }
});

app.delete('/api/program-chair/sections/:sectionId', authenticateToken, requireProgramChair, async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.sectionId)) return res.status(400).json({ error: 'Valid section is required.' });
    const sectionId = new ObjectId(req.params.sectionId);
    const result = await sectionsCollection.deleteOne({ _id: sectionId });
    if (!result.deletedCount) return res.status(404).json({ error: 'Section not found.' });
    await Promise.all([
      studentsCollection.updateMany({ sectionId }, { $set: { sectionId: null, updatedAt: new Date() } }),
      assignmentsCollection.deleteMany({ sectionId })
    ]);
    return res.json({ message: 'Section deleted successfully.' });
  } catch (error) {
    console.error('Error deleting section:', error);
    return res.status(500).json({ error: 'Failed to delete section.' });
  }
});

app.post('/api/program-chair/subjects', authenticateToken, requireProgramChair, async (req, res) => {
  try {
    const { code, description, yearLevel, term } = req.body;
    const normalizedCode = typeof code === 'string' ? code.trim().toUpperCase() : '';

    if (!/^[A-Z0-9-]+$/.test(normalizedCode)) {
      return res.status(400).json({ error: 'Subject code must use uppercase letters, numbers, or hyphens.' });
    }
    if (!description || typeof description !== 'string' || !description.trim()) {
      return res.status(400).json({ error: 'Subject description is required.' });
    }
    if (!yearLevel || typeof yearLevel !== 'string' || !yearLevel.trim()) {
      return res.status(400).json({ error: 'Year level is required.' });
    }
    if (!term || typeof term !== 'string' || !VALID_TERMS.includes(term.trim())) {
      return res.status(400).json({ error: `Semester must be one of: ${VALID_TERMS.join(', ')}.` });
    }

    const subject = {
      code: normalizedCode,
      description: description.trim(),
      yearLevel: yearLevel.trim(),
      term: term.trim(),
      createdBy: req.user.userId,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    const result = await subjectsCollection.insertOne(subject);
    return res.status(201).json({ subject: { ...subject, id: result.insertedId.toString() } });
  } catch (error) {
    console.error('Error creating subject:', error);
    if (error.code === 11000) {
      return res.status(409).json({ error: 'A subject with this code already exists.' });
    }
    return res.status(500).json({ error: 'Failed to create subject.' });
  }
});

app.patch('/api/program-chair/subjects/:subjectId', authenticateToken, requireProgramChair, async (req, res) => {
  try {
    const { code, description, yearLevel, term } = req.body;
    const normalizedCode = typeof code === 'string' ? code.trim().toUpperCase() : '';
    if (!ObjectId.isValid(req.params.subjectId) || !/^[A-Z0-9-]+$/.test(normalizedCode) ||
      !description?.trim() || !VALID_YEAR_LEVELS.includes(yearLevel) || !VALID_TERMS.includes(term)) {
      return res.status(400).json({ error: 'Valid subject code, description, year level, and semester are required.' });
    }
    const result = await subjectsCollection.findOneAndUpdate(
      { _id: new ObjectId(req.params.subjectId) },
      { $set: { code: normalizedCode, description: description.trim(), yearLevel, term, updatedAt: new Date() } },
      { returnDocument: 'after' }
    );
    if (!result) return res.status(404).json({ error: 'Subject not found.' });
    return res.json({ subject: { ...result, id: result._id.toString() } });
  } catch (error) {
    console.error('Error updating subject:', error);
    return res.status(error.code === 11000 ? 409 : 500).json({ error: error.code === 11000 ? 'A subject with this code already exists.' : 'Failed to update subject.' });
  }
});

app.delete('/api/program-chair/subjects/:subjectId', authenticateToken, requireProgramChair, async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.subjectId)) return res.status(400).json({ error: 'Valid subject is required.' });
    const result = await subjectsCollection.deleteOne({ _id: new ObjectId(req.params.subjectId) });
    if (!result.deletedCount) return res.status(404).json({ error: 'Subject not found.' });
    await Promise.all([
      enrollmentsCollection.deleteMany({ subjectId: new ObjectId(req.params.subjectId) }),
      assignmentsCollection.deleteMany({ subjectId: new ObjectId(req.params.subjectId) })
    ]);
    return res.json({ message: 'Subject deleted successfully.' });
  } catch (error) {
    console.error('Error deleting subject:', error);
    return res.status(500).json({ error: 'Failed to delete subject.' });
  }
});

app.get('/api/student/subjects', authenticateToken, requireStudent, async (req, res) => {
  try {
    if (!ObjectId.isValid(req.user.userId)) {
      return res.status(400).json({ error: 'Invalid student account.' });
    }

    const studentProfile = await studentsCollection.findOne({ userId: new ObjectId(req.user.userId) });
    if (!studentProfile?.yearLevel) {
      return res.json({ yearLevel: null, subjects: [], terms: [] });
    }

    const [subjects, enrollments] = await Promise.all([
      subjectsCollection
        .find({ yearLevel: studentProfile.yearLevel })
        .sort({ term: 1, code: 1 })
        .toArray(),
      enrollmentsCollection
        .find({ studentId: new ObjectId(req.user.userId) }, { projection: { subjectId: 1 } })
        .toArray()
    ]);
    const enrolledSubjectIds = new Set(enrollments.map((enrollment) => enrollment.subjectId.toString()));
    const serializedSubjects = subjects.map((subject) => ({
      id: subject._id.toString(),
      code: subject.code,
      description: subject.description,
      yearLevel: subject.yearLevel,
      term: subject.term,
      enrolled: enrolledSubjectIds.has(subject._id.toString())
    }));

    return res.json({
      yearLevel: studentProfile.yearLevel,
      subjects: serializedSubjects,
      terms: [...new Set(serializedSubjects.map((subject) => subject.term))]
    });
  } catch (error) {
    console.error('Error fetching student subjects:', error);
    return res.status(500).json({ error: 'Failed to fetch available subjects.' });
  }
});

app.post('/api/student/enrollments', authenticateToken, requireStudent, async (req, res) => {
  try {
    const { subjectId, term } = req.body;
    if (!ObjectId.isValid(subjectId) || typeof term !== 'string' || !term.trim()) {
      return res.status(400).json({ error: 'A valid subject and semester are required.' });
    }

    const studentId = new ObjectId(req.user.userId);
    const [studentProfile, subject] = await Promise.all([
      studentsCollection.findOne({ userId: studentId }),
      subjectsCollection.findOne({ _id: new ObjectId(subjectId) })
    ]);
    if (!studentProfile?.yearLevel) {
      return res.status(400).json({ error: 'Your year level must be assigned before enrollment.' });
    }
    if (!subject) {
      return res.status(404).json({ error: 'Subject not found.' });
    }
    if (subject.yearLevel !== studentProfile.yearLevel) {
      return res.status(400).json({ error: 'You can only enroll in subjects for your year level.' });
    }
    if (subject.term !== term.trim()) {
      return res.status(400).json({ error: 'You can only enroll in subjects for the selected semester.' });
    }

    const enrollment = {
      studentId,
      subjectId: new ObjectId(subjectId),
      enrolledBy: req.user.userId,
      enrolledByRole: 'student',
      createdAt: new Date()
    };
    const result = await enrollmentsCollection.insertOne(enrollment);
    return res.status(201).json({ enrollment: { ...enrollment, id: result.insertedId.toString() } });
  } catch (error) {
    console.error('Error enrolling student:', error);
    if (error.code === 11000) {
      return res.status(409).json({ error: 'Student is already enrolled in this subject.' });
    }
    return res.status(500).json({ error: 'Failed to enroll student.' });
  }
});

app.post('/api/program-chair/assignments', authenticateToken, requireProgramChair, async (req, res) => {
  try {
    const { facultyId, subjectId, sectionId } = req.body;
    if (!ObjectId.isValid(facultyId) || !ObjectId.isValid(subjectId) || !ObjectId.isValid(sectionId)) {
      return res.status(400).json({ error: 'Valid faculty member, subject, and section are required.' });
    }
    const faculty = await usersCollection.findOne({
      _id: new ObjectId(facultyId),
      role: { $in: ['faculty', 'instructor', 'program_chair'] }
    });
    const subject = await subjectsCollection.findOne({ _id: new ObjectId(subjectId) });
    const section = await sectionsCollection.findOne({ _id: new ObjectId(sectionId) });
    if (!faculty || !subject || !section) {
      return res.status(404).json({ error: 'Faculty member, subject, or section not found.' });
    }
    const assignment = {
      facultyId: new ObjectId(facultyId),
      subjectId: new ObjectId(subjectId),
      sectionId: new ObjectId(sectionId),
      assignedBy: req.user.userId,
      createdAt: new Date()
    };
    const result = await assignmentsCollection.insertOne(assignment);
    return res.status(201).json({ assignment: { ...assignment, id: result.insertedId.toString() } });
  } catch (error) {
    console.error('Error assigning subject:', error);
    if (error.code === 11000) {
      return res.status(409).json({ error: 'Subject is already assigned to this faculty member.' });
    }
    return res.status(500).json({ error: 'Failed to assign subject.' });
  }
});

async function getTeachingAssignments(userId) {
  const assignments = await assignmentsCollection
    .find({ facultyId: new ObjectId(userId) })
    .sort({ createdAt: -1 })
    .toArray();
  if (assignments.length === 0) return [];

  const subjectIds = assignments.map((assignment) => assignment.subjectId);
  const sectionIds = assignments.map((assignment) => assignment.sectionId);
  const [subjects, sections] = await Promise.all([
    subjectsCollection.find({ _id: { $in: subjectIds } }).toArray(),
    sectionsCollection.find({ _id: { $in: sectionIds } }).toArray()
  ]);
  const subjectsById = new Map(subjects.map((subject) => [subject._id.toString(), subject]));
  const sectionsById = new Map(sections.map((section) => [section._id.toString(), section]));

  return assignments
    .map((assignment) => {
      const subject = subjectsById.get(assignment.subjectId.toString());
      const section = sectionsById.get(assignment.sectionId.toString());
      if (!subject || !section) return null;
      return {
        id: subject._id.toString(),
        code: subject.code,
        description: subject.description,
        yearLevel: subject.yearLevel,
        term: subject.term,
        sectionId: section._id.toString(),
        sectionName: section.name
      };
    })
    .filter(Boolean);
}

async function hasTeachingAssignment(userId, subjectId) {
  return assignmentsCollection.findOne({
    facultyId: new ObjectId(userId),
    subjectId: new ObjectId(subjectId)
  });
}

app.get('/api/teaching/subjects', authenticateToken, requireTeachingStaff, async (req, res) => {
  try {
    return res.json({ subjects: await getTeachingAssignments(req.user.userId) });
  } catch (error) {
    console.error('Error fetching teaching subjects:', error);
    return res.status(500).json({ error: 'Failed to fetch assigned subjects.' });
  }
});

app.get('/api/teaching/lessons', authenticateToken, requireTeachingStaff, async (req, res) => {
  try {
    const assignments = await getTeachingAssignments(req.user.userId);
    const subjectIds = assignments.map((subject) => new ObjectId(subject.id));
    const lessons = subjectIds.length
      ? await lessonsCollection.find({ subjectId: { $in: subjectIds } }).sort({ updatedAt: -1 }).toArray()
      : [];
    return res.json({ lessons: lessons.map(serializeLesson) });
  } catch (error) {
    console.error('Error fetching teaching lessons:', error);
    return res.status(500).json({ error: 'Failed to fetch lessons.' });
  }
});

app.post('/api/teaching/lessons', authenticateToken, requireTeachingStaff, async (req, res) => {
  try {
    const { subjectId, title, description, slides } = req.body;
    if (!ObjectId.isValid(subjectId) || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'A valid subject and lesson title are required.' });
    }
    if (!Array.isArray(slides) || slides.length === 0) {
      return res.status(400).json({ error: 'At least one lesson slide is required.' });
    }
    if (!await hasTeachingAssignment(req.user.userId, subjectId)) {
      return res.status(403).json({ error: 'You can only create lessons for assigned subjects.' });
    }
    const now = new Date();
    const lesson = {
      subjectId: new ObjectId(subjectId),
      title: title.trim(),
      description: typeof description === 'string' ? description.trim() : '',
      type: 'slides',
      slides: slides.map((slide) => ({
        title: typeof slide?.title === 'string' ? slide.title.trim() : '',
        body: typeof slide?.body === 'string' ? slide.body.trim() : ''
      })).filter((slide) => slide.title || slide.body),
      createdBy: new ObjectId(req.user.userId),
      createdAt: now,
      updatedAt: now
    };
    if (lesson.slides.length === 0) {
      return res.status(400).json({ error: 'Slides must contain a title or content.' });
    }
    const result = await lessonsCollection.insertOne(lesson);
    return res.status(201).json({ lesson: serializeLesson({ ...lesson, _id: result.insertedId }) });
  } catch (error) {
    console.error('Error creating lesson:', error);
    return res.status(500).json({ error: 'Failed to create lesson.' });
  }
});

app.post('/api/teaching/lessons/upload', authenticateToken, requireTeachingStaff, (req, res) => {
  lessonUpload.single('file')(req, res, async (uploadError) => {
    if (uploadError) {
      console.error('Lesson upload error:', uploadError);
      return res.status(400).json({ error: uploadError.message || 'Failed to upload lesson file.' });
    }
    try {
      const { subjectId, title, description } = req.body;
      if (!ObjectId.isValid(subjectId) || typeof title !== 'string' || !title.trim() || !req.file) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: 'A valid subject, lesson title, and file are required.' });
      }
      if (!await hasTeachingAssignment(req.user.userId, subjectId)) {
        fs.unlinkSync(req.file.path);
        return res.status(403).json({ error: 'You can only upload lessons for assigned subjects.' });
      }
      const now = new Date();
      const lesson = {
        subjectId: new ObjectId(subjectId),
        title: title.trim(),
        description: typeof description === 'string' ? description.trim() : '',
        type: 'file',
        fileName: req.file.filename,
        slides: [],
        createdBy: new ObjectId(req.user.userId),
        createdAt: now,
        updatedAt: now
      };
      const result = await lessonsCollection.insertOne(lesson);
      return res.status(201).json({ lesson: serializeLesson({ ...lesson, _id: result.insertedId }) });
    } catch (error) {
      console.error('Error creating uploaded lesson:', error);
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(500).json({ error: 'Failed to save uploaded lesson.' });
    }
  });
});

app.patch('/api/teaching/lessons/:lessonId', authenticateToken, requireTeachingStaff, async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.lessonId)) {
      return res.status(400).json({ error: 'Valid lesson is required.' });
    }
    const lesson = await lessonsCollection.findOne({ _id: new ObjectId(req.params.lessonId) });
    if (!lesson) return res.status(404).json({ error: 'Lesson not found.' });
    if (!await hasTeachingAssignment(req.user.userId, lesson.subjectId.toString())) {
      return res.status(403).json({ error: 'You can only edit lessons for assigned subjects.' });
    }
    const updates = {};
    if (typeof req.body.title === 'string' && req.body.title.trim()) updates.title = req.body.title.trim();
    if (typeof req.body.description === 'string') updates.description = req.body.description.trim();
    if (Array.isArray(req.body.slides)) {
      updates.slides = req.body.slides
        .map((slide) => ({
          title: typeof slide?.title === 'string' ? slide.title.trim() : '',
          body: typeof slide?.body === 'string' ? slide.body.trim() : ''
        }))
        .filter((slide) => slide.title || slide.body);
      if (lesson.type === 'slides' && updates.slides.length === 0) {
        return res.status(400).json({ error: 'Slides must contain a title or content.' });
      }
    }
    if (!updates.title && !updates.description && !updates.slides) {
      return res.status(400).json({ error: 'A lesson title, description, or slides update is required.' });
    }
    updates.updatedAt = new Date();
    await lessonsCollection.updateOne({ _id: lesson._id }, { $set: updates });
    return res.json({ lesson: serializeLesson({ ...lesson, ...updates }) });
  } catch (error) {
    console.error('Error updating lesson:', error);
    return res.status(500).json({ error: 'Failed to update lesson.' });
  }
});

app.patch('/api/teaching/lessons/:lessonId/upload', authenticateToken, requireTeachingStaff, (req, res) => {
  lessonUpload.single('file')(req, res, async (uploadError) => {
    if (uploadError) {
      console.error('Lesson replacement upload error:', uploadError);
      return res.status(400).json({ error: uploadError.message || 'Failed to upload replacement file.' });
    }
    try {
      if (!ObjectId.isValid(req.params.lessonId) || !req.file) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: 'Valid lesson and replacement file are required.' });
      }
      const lesson = await lessonsCollection.findOne({ _id: new ObjectId(req.params.lessonId) });
      if (!lesson) {
        fs.unlinkSync(req.file.path);
        return res.status(404).json({ error: 'Lesson not found.' });
      }
      if (!await hasTeachingAssignment(req.user.userId, lesson.subjectId.toString())) {
        fs.unlinkSync(req.file.path);
        return res.status(403).json({ error: 'You can only edit lessons for assigned subjects.' });
      }
      const updates = {
        fileName: req.file.filename,
        type: 'file',
        slides: [],
        updatedAt: new Date()
      };
      await lessonsCollection.updateOne({ _id: lesson._id }, { $set: updates });
      if (lesson.fileName) {
        const oldFilePath = path.join(lessonUploadDirectory, lesson.fileName);
        if (fs.existsSync(oldFilePath)) fs.unlinkSync(oldFilePath);
      }
      return res.json({ lesson: serializeLesson({ ...lesson, ...updates }) });
    } catch (error) {
      console.error('Error replacing lesson file:', error);
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(500).json({ error: 'Failed to replace lesson file.' });
    }
  });
});

app.delete('/api/teaching/lessons/:lessonId', authenticateToken, requireTeachingStaff, async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.lessonId)) {
      return res.status(400).json({ error: 'Valid lesson is required.' });
    }
    const lesson = await lessonsCollection.findOne({ _id: new ObjectId(req.params.lessonId) });
    if (!lesson) return res.status(404).json({ error: 'Lesson not found.' });
    if (!await hasTeachingAssignment(req.user.userId, lesson.subjectId.toString())) {
      return res.status(403).json({ error: 'You can only delete lessons for assigned subjects.' });
    }
    await lessonsCollection.deleteOne({ _id: lesson._id });
    if (lesson.fileName) {
      const filePath = path.join(lessonUploadDirectory, lesson.fileName);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    return res.json({ message: 'Lesson deleted successfully.' });
  } catch (error) {
    console.error('Error deleting lesson:', error);
    return res.status(500).json({ error: 'Failed to delete lesson.' });
  }
});

app.get('/api/student/lessons', authenticateToken, requireStudent, async (req, res) => {
  try {
    const enrollments = await enrollmentsCollection.find({ studentId: new ObjectId(req.user.userId) }).toArray();
    const subjectIds = enrollments.map((enrollment) => enrollment.subjectId);
    const lessons = subjectIds.length
      ? await lessonsCollection.find({ subjectId: { $in: subjectIds } }).sort({ updatedAt: -1 }).toArray()
      : [];
    return res.json({ lessons: lessons.map(serializeLesson) });
  } catch (error) {
    console.error('Error fetching student lessons:', error);
    return res.status(500).json({ error: 'Failed to fetch lessons.' });
  }
});

// Super admin user management
app.get('/api/admin/users', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const users = await usersCollection
      .find({}, { projection: { password: 0 } })
      .sort({ name: 1 })
      .toArray();

    return res.json({
      users: users.map((user) => ({
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role || 'student',
        createdAt: user.createdAt
      }))
    });
  } catch (error) {
    console.error('Error fetching users for admin:', error);
    return res.status(500).json({ error: 'Failed to fetch users.' });
  }
});

app.patch('/api/admin/users/:userId/role', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { role } = req.body;
    const validRoles = ['student', 'faculty', 'program_chair', 'super_admin'];

    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Role must be student, faculty, program_chair, or super_admin.' });
    }

    if (!ObjectId.isValid(req.params.userId)) {
      return res.status(400).json({ error: 'Invalid user ID.' });
    }

    const result = await usersCollection.findOneAndUpdate(
      { _id: new ObjectId(req.params.userId) },
      { $set: { role, updatedAt: new Date() } },
      { returnDocument: 'after', projection: { password: 0 } }
    );

    if (!result) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const profileCollection = role === 'student'
      ? studentsCollection
      : role === 'faculty'
        ? facultyCollection
        : role === 'program_chair'
          ? programChairsCollection
          : null;
    if (profileCollection) {
      await profileCollection.updateOne(
        { userId: result._id },
        { $setOnInsert: { userId: result._id, createdAt: new Date() }, $set: { updatedAt: new Date() } },
        { upsert: true }
      );
    }

    return res.json({
      message: 'User role updated successfully.',
      user: {
        id: result._id.toString(),
        name: result.name,
        email: result.email,
        role: result.role,
        createdAt: result.createdAt
      }
    });

  } catch (error) {
    console.error('Error updating user role:', error);
    return res.status(500).json({ error: 'Failed to update user role.' });
  }
});

app.patch('/api/admin/students/:userId/placement', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { yearLevel, sectionId } = req.body;
    if (!yearLevel || typeof yearLevel !== 'string' || !ObjectId.isValid(sectionId)) {
      return res.status(400).json({ error: 'Year level and valid section are required.' });
    }
    const section = await sectionsCollection.findOne({ _id: new ObjectId(sectionId) });
    const student = await usersCollection.findOne({ _id: new ObjectId(req.params.userId), role: 'student' });
    if (!section || !student) return res.status(404).json({ error: 'Student or section not found.' });
    await studentsCollection.updateOne(
      { userId: student._id },
      { $set: { yearLevel: yearLevel.trim(), sectionId: new ObjectId(sectionId), updatedAt: new Date() } },
      { upsert: true }
    );
    return res.json({ message: 'Student placement updated successfully.' });
  } catch (error) {
    console.error('Error updating student placement:', error);
    return res.status(500).json({ error: 'Failed to update student placement.' });
  }
});

app.patch('/api/program-chair/students/:userId/placement', authenticateToken, requireProgramChair, async (req, res) => {
  try {
    const { yearLevel, sectionId } = req.body;
    if (!VALID_YEAR_LEVELS.includes(yearLevel) || !ObjectId.isValid(sectionId)) {
      return res.status(400).json({ error: 'Valid year level and section are required.' });
    }
    const [section, student] = await Promise.all([
      sectionsCollection.findOne({ _id: new ObjectId(sectionId), yearLevel }),
      usersCollection.findOne({ _id: new ObjectId(req.params.userId), role: 'student' })
    ]);
    if (!section || !student) return res.status(404).json({ error: 'Student or matching section not found.' });
    await studentsCollection.updateOne(
      { userId: student._id },
      { $set: { yearLevel, sectionId: new ObjectId(sectionId), updatedAt: new Date() } },
      { upsert: true }
    );
    return res.json({ message: 'Student placement updated successfully.' });
  } catch (error) {
    console.error('Error updating program chair student placement:', error);
    return res.status(500).json({ error: 'Failed to update student placement.' });
  }
});

app.get('/api/admin/academic', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const [programs, sections] = await Promise.all([
      programsCollection.find({}).sort({ name: 1 }).toArray(),
      sectionsCollection.find({}).sort({ name: 1 }).toArray()
    ]);
    return res.json({ programs, sections });
  } catch (error) {
    console.error('Error fetching academic structure:', error);
    return res.status(500).json({ error: 'Failed to fetch academic structure.' });
  }
});

app.post('/api/admin/academic/programs', authenticateToken, requireSuperAdmin, async (req, res) => {
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  if (!name) return res.status(400).json({ error: 'Program name is required.' });
  try {
    const result = await programsCollection.insertOne({ name, createdAt: new Date() });
    return res.status(201).json({ program: { id: result.insertedId.toString(), name } });
  } catch (error) {
    console.error('Error creating program:', error);
    return res.status(error.code === 11000 ? 409 : 500).json({ error: 'Failed to create program.' });
  }
});

app.post('/api/admin/academic/sections', authenticateToken, requireSuperAdmin, async (req, res) => {
  const { name, yearLevel, programId, courseId } = req.body;
  const targetProgramId = programId || courseId;
  if (!name || !yearLevel || !targetProgramId || !ObjectId.isValid(targetProgramId)) {
    return res.status(400).json({ error: 'Section name, year level, and valid program are required.' });
  }
  let prog = await programsCollection.findOne({ _id: new ObjectId(targetProgramId) });
  if (!prog) {
    prog = await coursesCollection.findOne({ _id: new ObjectId(targetProgramId) });
  }
  if (!prog) return res.status(404).json({ error: 'Program not found.' });
  try {
    const result = await sectionsCollection.insertOne({
      name: name.trim(),
      yearLevel: yearLevel.trim(),
      programId: new ObjectId(targetProgramId),
      courseId: new ObjectId(targetProgramId),
      programName: prog.name,
      createdAt: new Date()
    });
    return res.status(201).json({
      section: {
        id: result.insertedId.toString(),
        name: name.trim(),
        yearLevel: yearLevel.trim(),
        programId: targetProgramId,
        programName: prog.name
      }
    });
  } catch (error) {
    console.error('Error creating section:', error);
    return res.status(error.code === 11000 ? 409 : 500).json({ error: 'Failed to create section.' });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'API route not found' });
});

// Start server
async function start() {
  await mongoClient.connect();
  database = mongoClient.db(databaseName);
  usersCollection = database.collection('users');
  subjectsCollection = database.collection('subjects');
  enrollmentsCollection = database.collection('enrollments');
  assignmentsCollection = database.collection('subjectAssignments');
  lessonsCollection = database.collection('lessons');
  studentsCollection = database.collection('students');
  facultyCollection = database.collection('faculty');
  programChairsCollection = database.collection('programChairs');
  programsCollection = database.collection('programs');
  coursesCollection = database.collection('courses');
  sectionsCollection = database.collection('sections');

  // Create unique index on email
  await usersCollection.createIndex({ email: 1 }, { unique: true });
  await subjectsCollection.createIndex({ code: 1, yearLevel: 1, term: 1 }, { unique: true });
  await enrollmentsCollection.createIndex({ studentId: 1, subjectId: 1 }, { unique: true });
  try {
    await assignmentsCollection.dropIndex('facultyId_1_subjectId_1');
  } catch (error) {
    if (error.codeName !== 'IndexNotFound' && error.codeName !== 'NamespaceNotFound') {
      throw error;
    }
  }
  await assignmentsCollection.createIndex({ facultyId: 1, subjectId: 1, sectionId: 1 }, { unique: true });
  await studentsCollection.createIndex({ userId: 1 }, { unique: true });
  await facultyCollection.createIndex({ userId: 1 }, { unique: true });
  await programChairsCollection.createIndex({ userId: 1 }, { unique: true });
  await programsCollection.createIndex({ name: 1 }, { unique: true });
  await coursesCollection.createIndex({ name: 1, programId: 1 }, { unique: true });
  await sectionsCollection.createIndex({ name: 1, courseId: 1, yearLevel: 1 }, { unique: true });
  await database.command({ ping: 1 });

  app.listen(port, '0.0.0.0', () => {
    console.log(`Backend server listening on port ${port} on all network interfaces`);
    console.log(`Connected to MongoDB database "${databaseName}"`);
    console.log(`Auth endpoints available:`);
    console.log(`  POST http://localhost:${port}/api/auth/register`);
    console.log(`  POST http://localhost:${port}/api/auth/login`);
    console.log(`  GET  http://localhost:${port}/api/auth/me`);
  });
}

start().catch((error) => {
  console.error('Unable to connect to MongoDB:', error);
  process.exitCode = 1;
});
