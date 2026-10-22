import React from 'react';
import StaffPage from '../../components/StaffPage';
import { useAuth } from '../../context/AuthContext';

export default function GradesScreen() {
  const { user } = useAuth();
  return (
    <StaffPage
      role={user?.role === 'program_chair' ? 'programchair' : 'faculty'}
      activeRoute="/grades"
      title="Grades"
      icon="school-outline"
      message="No student submissions are available for grading yet."
    />
  );
}
