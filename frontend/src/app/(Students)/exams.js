import React from 'react';
import StudentPage from '../../components/(Students)/StudentPage';
import StaffPage from '../../components/StaffPage';
import { useAuth } from '../../context/AuthContext';

export default function ExamsScreen() {
  const { user } = useAuth();
  if (user?.role === 'faculty' || user?.role === 'instructor' || user?.role === 'program_chair') {
    return (
      <StaffPage
        role={user.role === 'program_chair' ? 'programchair' : 'faculty'}
        activeRoute="/exams"
        title="Exams"
        icon="document-text-outline"
        message="No exams are available yet. Faculty can create quizzes and examinations here."
      />
    );
  }

  return (
    <StudentPage
      activeRoute="/exams"
      title="Exams"
      icon="document-text-outline"
      message="No exams are available yet."
    />
  );
}
