// This is an Express.js backend for additional features
// To use this, you'll need to deploy it separately (Render, Railway, etc.)

const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Firebase Admin
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// Get user profile
app.get('/api/users/:userId', async (req, res) => {
  try {
    const userDoc = await db.collection('users').doc(req.params.userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ id: userDoc.id, ...userDoc.data() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update user preferences
app.put('/api/users/:userId/preferences', async (req, res) => {
  try {
    const { preferences } = req.body;
    await db.collection('users').doc(req.params.userId).update({
      preferences,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get matches for user
app.get('/api/users/:userId/matches', async (req, res) => {
  try {
    const matchesSnapshot = await db.collection('matches')
      .where('users', 'array-contains', req.params.userId)
      .where('status', '==', 'matched')
      .get();
    
    const matches = await Promise.all(
      matchesSnapshot.docs.map(async (doc) => {
        const data = doc.data();
        const otherUserId = data.users.find(id => id !== req.params.userId);
        const userDoc = await db.collection('users').doc(otherUserId).get();
        return {
          matchId: doc.id,
          user: { id: otherUserId, ...userDoc.data() },
          matchedAt: data.matchedAt?.toDate()
        };
      })
    );
    
    res.json(matches);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get conversations
app.get('/api/users/:userId/conversations', async (req, res) => {
  try {
    const conversationsSnapshot = await db.collection('conversations')
      .where('users', 'array-contains', req.params.userId)
      .orderBy('lastMessageAt', 'desc')
      .get();
    
    const conversations = await Promise.all(
      conversationsSnapshot.docs.map(async (doc) => {
        const data = doc.data();
        const otherUserId = data.users.find(id => id !== req.params.userId);
        const userDoc = await db.collection('users').doc(otherUserId).get();
        return {
          conversationId: doc.id,
          user: { id: otherUserId, ...userDoc.data() },
          lastMessage: data.lastMessage,
          lastMessageAt: data.lastMessageAt?.toDate(),
          unreadCount: data.unreadCount?.[req.params.userId] || 0
        };
      })
    );
    
    res.json(conversations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
