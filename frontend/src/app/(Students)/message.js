import React from 'react';
import StudentPage from '../../components/(Students)/StudentPage';

export default function MessageScreen() {
  return (
    <StudentPage
      activeRoute="/message"
      title="Messages"
      icon="chatbubble-ellipses-outline"
      message="No messages are available yet."
    />
  );
}
