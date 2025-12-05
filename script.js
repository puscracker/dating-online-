// ===== FIREBASE CONFIGURATION =====
// REPLACE WITH YOUR FIREBASE CONFIG
const firebaseConfig = {
    apiKey: "AIzaSyDU3HxRhR7h1uhu8yKKkD0dySP_5N7J8H0",
    authDomain: "realconnect-dating.firebaseapp.com",
    projectId: "realconnect-dating",
    storageBucket: "realconnect-dating.appspot.com",
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:abcdef1234567890"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// ===== APP STATE =====
let currentUser = null;
let currentChatUser = null;
let profiles = [];
let matches = [];
let messages = [];
let userListener = null;
let chatListener = null;

// ===== AUTHENTICATION =====
function showTab(tabName) {
    // Hide all forms
    document.querySelectorAll('.auth-form').forEach(form => {
        form.classList.remove('active');
    });
    
    // Deactivate all tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected form
    document.getElementById(tabName + 'Form').classList.add('active');
    
    // Activate selected tab
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
}

async function signup() {
    try {
        const name = document.getElementById('signupName').value;
        const email = document.getElementById('signupEmail').value;
        const password = document.getElementById('signupPassword').value;
        const age = document.getElementById('signupAge').value;
        const gender = document.getElementById('signupGender').value;
        const bio = document.getElementById('signupBio').value;

        // Validation
        if (!name || !email || !password || !age || !gender) {
            showNotification('Please fill all required fields');
            return;
        }

        // Create user with email/password
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        // Create user profile in Firestore
        await db.collection('users').doc(user.uid).set({
            uid: user.uid,
            name: name,
            email: email,
            age: parseInt(age),
            gender: gender,
            bio: bio || '',
            photos: [],
            location: null,
            preferences: {
                ageRange: [18, 40],
                gender: 'all'
            },
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            lastActive: firebase.firestore.FieldValue.serverTimestamp(),
            isActive: true
        });

        showNotification('Account created successfully!', 'success');
        document.getElementById('authModal').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
        
        // Initialize user data
        initializeUserData(user.uid);

    } catch (error) {
        console.error('Signup error:', error);
        showNotification(error.message, 'error');
    }
}

async function login() {
    try {
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

        if (!email || !password) {
            showNotification('Please enter email and password');
            return;
        }

        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const user = userCredential.user;

        // Update last active time
        await db.collection('users').doc(user.uid).update({
            lastActive: firebase.firestore.FieldValue.serverTimestamp(),
            isActive: true
        });

        showNotification('Logged in successfully!', 'success');
        document.getElementById('authModal').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
        
        // Initialize user data
        initializeUserData(user.uid);

    } catch (error) {
        console.error('Login error:', error);
        showNotification(error.message, 'error');
    }
}

async function logout() {
    try {
        if (currentUser) {
            // Update user status
            await db.collection('users').doc(currentUser.uid).update({
                lastActive: firebase.firestore.FieldValue.serverTimestamp(),
                isActive: false
            });
        }
        
        // Remove listeners
        if (userListener) userListener();
        if (chatListener) chatListener();
        
        // Sign out
        await auth.signOut();
        
        // Reset state
        currentUser = null;
        profiles = [];
        matches = [];
        messages = [];
        
        // Reset UI
        document.getElementById('app').classList.add('hidden');
        document.getElementById('authModal').classList.remove('hidden');
        showTab('login');
        
        showNotification('Logged out successfully', 'success');
        
    } catch (error) {
        console.error('Logout error:', error);
        showNotification(error.message, 'error');
    }
}

// ===== USER DATA MANAGEMENT =====
async function initializeUserData(userId) {
    try {
        // Get user data
        const userDoc = await db.collection('users').doc(userId).get();
        if (userDoc.exists) {
            currentUser = {
                uid: userId,
                ...userDoc.data()
            };
            
            // Update profile page
            updateProfilePage();
            
            // Set up real-time listener for user updates
            userListener = db.collection('users').doc(userId)
                .onSnapshot((doc) => {
                    if (doc.exists) {
                        currentUser = {
                            uid: userId,
                            ...doc.data()
                        };
                        updateProfilePage();
                    }
                });
            
            // Load initial data
            await Promise.all([
                loadProfiles(),
                loadMatches(),
                loadConversations()
            ]);
            
        } else {
            showNotification('User data not found', 'error');
        }
    } catch (error) {
        console.error('Initialize user data error:', error);
        showNotification(error.message, 'error');
    }
}

// ===== PROFILE MANAGEMENT =====
async function loadProfiles() {
    try {
        if (!currentUser) return;
        
        // Get users excluding current user and already matched/rejected
        const matchesSnapshot = await db.collection('matches')
            .where('users', 'array-contains', currentUser.uid)
            .get();
        
        const interactedUsers = matchesSnapshot.docs.map(doc => {
            const data = doc.data();
            return data.users.find(id => id !== currentUser.uid);
        });
        
        // Query users
        let query = db.collection('users')
            .where('isActive', '==', true)
            .where('uid', '!=', currentUser.uid);
        
        // Apply gender preference
        if (currentUser.preferences?.gender !== 'all') {
            query = query.where('gender', '==', currentUser.preferences.gender);
        }
        
        // Apply age range
        if (currentUser.preferences?.ageRange) {
            const [minAge, maxAge] = currentUser.preferences.ageRange;
            query = query.where('age', '>=', minAge)
                        .where('age', '<=', maxAge);
        }
        
        const snapshot = await query.limit(20).get();
        profiles = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(user => !interactedUsers.includes(user.id));
        
        // Display profiles
        displayProfiles();
        
    } catch (error) {
        console.error('Load profiles error:', error);
        showNotification(error.message, 'error');
    }
}

function displayProfiles() {
    const container = document.getElementById('profilesContainer');
    if (!container) return;
    
    if (profiles.length === 0) {
        container.innerHTML = `
            <div class="no-profiles">
                <i class="fas fa-user-friends"></i>
                <h3>No more profiles to show</h3>
                <p>Check back later for new matches!</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = profiles.map(profile => `
        <div class="profile-card" data-id="${profile.id}">
            <div class="profile-image-placeholder">
                <i class="fas fa-user"></i>
            </div>
            <div class="profile-content">
                <h3 class="profile-name">${profile.name}, ${profile.age}</h3>
                <p class="profile-details">${profile.gender} • Last active recently</p>
                <p class="profile-bio">${profile.bio || 'No bio provided'}</p>
                <div class="profile-actions">
                    <button class="btn-dislike" onclick="handleDislike('${profile.id}')">
                        <i class="fas fa-times"></i> Pass
                    </button>
                    <button class="btn-like" onclick="handleLike('${profile.id}')">
                        <i class="fas fa-heart"></i> Like
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

async function handleLike(profileId) {
    try {
        if (!currentUser) return;
        
        // Create match document
        const matchId = [currentUser.uid, profileId].sort().join('_');
        await db.collection('matches').doc(matchId).set({
            users: [currentUser.uid, profileId],
            status: 'pending',
            likedBy: currentUser.uid,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Check if mutual like
        const matchDoc = await db.collection('matches').doc(matchId).get();
        if (matchDoc.exists && matchDoc.data().likedBy !== currentUser.uid) {
            // It's a match!
            await db.collection('matches').doc(matchId).update({
                status: 'matched',
                matchedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            // Create chat conversation
            await db.collection('conversations').doc(matchId).set({
                users: [currentUser.uid, profileId],
                lastMessage: '',
                lastMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
                unreadCount: { [currentUser.uid]: 0, [profileId]: 0 }
            });
            
            showNotification('🎉 It\'s a match!', 'success');
        } else {
            showNotification('Liked! They\'ll see your like', 'success');
        }
        
        // Remove profile from view
        profiles = profiles.filter(p => p.id !== profileId);
        displayProfiles();
        
        // Update matches badge
        updateMatchesBadge();
        
    } catch (error) {
        console.error('Like error:', error);
        showNotification(error.message, 'error');
    }
}

async function handleDislike(profileId) {
    try {
        if (!currentUser) return;
        
        // Create dislike record
        const matchId = [currentUser.uid, profileId].sort().join('_');
        await db.collection('matches').doc(matchId).set({
            users: [currentUser.uid, profileId],
            status: 'rejected',
            rejectedBy: currentUser.uid,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Remove profile from view
        profiles = profiles.filter(p => p.id !== profileId);
        displayProfiles();
        
        showNotification('Profile passed', 'info');
        
    } catch (error) {
        console.error('Dislike error:', error);
        showNotification(error.message, 'error');
    }
}

// ===== MATCHES =====
async function loadMatches() {
    try {
        if (!currentUser) return;
        
        const snapshot = await db.collection('matches')
            .where('users', 'array-contains', currentUser.uid)
            .where('status', '==', 'matched')
            .get();
        
        matches = await Promise.all(
            snapshot.docs.map(async (doc) => {
                const data = doc.data();
                const otherUserId = data.users.find(id => id !== currentUser.uid);
                const userDoc = await db.collection('users').doc(otherUserId).get();
                return {
                    matchId: doc.id,
                    user: { id: otherUserId, ...userDoc.data() },
                    matchedAt: data.matchedAt?.toDate()
                };
            })
        );
        
        displayMatches();
        updateMatchesBadge();
        
    } catch (error) {
        console.error('Load matches error:', error);
        showNotification(error.message, 'error');
    }
}

function displayMatches() {
    const container = document.getElementById('matchesContainer');
    if (!container) return;
    
    if (matches.length === 0) {
        container.innerHTML = `
            <div class="no-matches">
                <i class="fas fa-heart"></i>
                <h3>No matches yet</h3>
                <p>Start liking profiles to get matches!</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = matches.map(match => `
        <div class="match-card">
            <div class="match-avatar">
                <i class="fas fa-user"></i>
            </div>
            <h4 class="match-name">${match.user.name}</h4>
            <p class="match-info">${match.user.age} • ${match.user.gender}</p>
            <button class="btn-chat" onclick="openChat('${match.user.id}', '${match.user.name}')">
                <i class="fas fa-comment"></i> Message
            </button>
        </div>
    `).join('');
}

function updateMatchesBadge() {
    const badge = document.getElementById('matchesBadge');
    if (badge) {
        badge.textContent = matches.length;
        badge.style.display = matches.length > 0 ? 'flex' : 'none';
    }
}

// ===== MESSAGES =====
async function loadConversations() {
    try {
        if (!currentUser) return;
        
        const snapshot = await db.collection('conversations')
            .where('users', 'array-contains', currentUser.uid)
            .orderBy('lastMessageAt', 'desc')
            .get();
        
        conversations = await Promise.all(
            snapshot.docs.map(async (doc) => {
                const data = doc.data();
                const otherUserId = data.users.find(id => id !== currentUser.uid);
                const userDoc = await db.collection('users').doc(otherUserId).get();
                return {
                    conversationId: doc.id,
                    user: { id: otherUserId, ...userDoc.data() },
                    lastMessage: data.lastMessage,
                    lastMessageAt: data.lastMessageAt?.toDate(),
                    unreadCount: data.unreadCount?.[currentUser.uid] || 0
                };
            })
        );
        
        displayConversations();
        updateMessagesBadge();
        
    } catch (error) {
        console.error('Load conversations error:', error);
        showNotification(error.message, 'error');
    }
}

function displayConversations() {
    const container = document.getElementById('conversationsList');
    if (!container) return;
    
    if (conversations.length === 0) {
        container.innerHTML = `
            <div class="no-conversations">
                <i class="fas fa-comments"></i>
                <h3>No messages yet</h3>
                <p>Match with someone to start chatting!</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = conversations.map(conv => `
        <div class="conversation-item" onclick="openChat('${conv.user.id}', '${conv.user.name}')">
            <div class="conversation-avatar">
                <i class="fas fa-user"></i>
            </div>
            <div class="conversation-content">
                <h4 class="conversation-name">${conv.user.name}</h4>
                <p class="conversation-preview">${conv.lastMessage || 'No messages yet'}</p>
            </div>
            <div class="conversation-time">
                ${conv.lastMessageAt ? formatTime(conv.lastMessageAt) : ''}
            </div>
            ${conv.unreadCount > 0 ? `
                <span class="badge">${conv.unreadCount}</span>
            ` : ''}
        </div>
    `).join('');
}

async function openChat(userId, userName) {
    try {
        currentChatUser = { id: userId, name: userName };
        
        // Update chat UI
        document.getElementById('chatUserName').textContent = userName;
        document.getElementById('chatModal').classList.remove('hidden');
        
        // Load messages
        await loadMessages(userId);
        
        // Set up real-time listener for messages
        const conversationId = [currentUser.uid, userId].sort().join('_');
        chatListener = db.collection('messages')
            .where('conversationId', '==', conversationId)
            .orderBy('timestamp', 'asc')
            .onSnapshot((snapshot) => {
                snapshot.docChanges().forEach((change) => {
                    if (change.type === 'added') {
                        const message = { id: change.doc.id, ...change.doc.data() };
                        displayMessage(message);
                    }
                });
                
                // Mark as read
                markMessagesAsRead(conversationId);
            });
        
    } catch (error) {
        console.error('Open chat error:', error);
        showNotification(error.message, 'error');
    }
}

async function loadMessages(userId) {
    try {
        const conversationId = [currentUser.uid, userId].sort().join('_');
        const snapshot = await db.collection('messages')
            .where('conversationId', '==', conversationId)
            .orderBy('timestamp', 'asc')
            .limit(50)
            .get();
        
        messages = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        // Display messages
        const container = document.getElementById('chatMessages');
        container.innerHTML = '';
        messages.forEach(message => displayMessage(message));
        
        // Scroll to bottom
        setTimeout(() => {
            container.scrollTop = container.scrollHeight;
        }, 100);
        
    } catch (error) {
        console.error('Load messages error:', error);
        showNotification(error.message, 'error');
    }
}

function displayMessage(message) {
    const container = document.getElementById('chatMessages');
    const isSent = message.senderId === currentUser.uid;
    
    const messageElement = document.createElement('div');
    messageElement.className = `message ${isSent ? 'sent' : 'received'}`;
    messageElement.innerHTML = `
        <div>${message.text}</div>
        <div class="message-time">${formatTime(message.timestamp?.toDate())}</div>
    `;
    
    container.appendChild(messageElement);
    
    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
}

async function sendMessage() {
    try {
        if (!currentUser || !currentChatUser) return;
        
        const input = document.getElementById('messageInput');
        const text = input.value.trim();
        
        if (!text) return;
        
        const conversationId = [currentUser.uid, currentChatUser.id].sort().join('_');
        
        // Create message
        await db.collection('messages').add({
            conversationId: conversationId,
            senderId: currentUser.uid,
            receiverId: currentChatUser.id,
            text: text,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            read: false
        });
        
        // Update conversation
        await db.collection('conversations').doc(conversationId).update({
            lastMessage: text,
            lastMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
            [`unreadCount.${currentChatUser.id}`]: firebase.firestore.FieldValue.increment(1)
        });
        
        // Clear input
        input.value = '';
        
    } catch (error) {
        console.error('Send message error:', error);
        showNotification(error.message, 'error');
    }
}

async function markMessagesAsRead(conversationId) {
    try {
        // Reset unread count
        await db.collection('conversations').doc(conversationId).update({
            [`unreadCount.${currentUser.uid}`]: 0
        });
        
        // Mark messages as read
        const snapshot = await db.collection('messages')
            .where('conversationId', '==', conversationId)
            .where('receiverId', '==', currentUser.uid)
            .where('read', '==', false)
            .get();
        
        const batch = db.batch();
        snapshot.docs.forEach(doc => {
            batch.update(doc.ref, { read: true });
        });
        
        if (snapshot.docs.length > 0) {
            await batch.commit();
        }
        
    } catch (error) {
        console.error('Mark as read error:', error);
    }
}

function closeChat() {
    if (chatListener) chatListener();
    currentChatUser = null;
    document.getElementById('chatModal').classList.add('hidden');
    document.getElementById('messageInput').value = '';
}

// ===== PROFILE PAGE =====
function updateProfilePage() {
    if (!currentUser) return;
    
    document.getElementById('profileName').textContent = currentUser.name;
    document.getElementById('profileAgeGender').textContent = 
        `${currentUser.age} • ${currentUser.gender}`;
    document.getElementById('profileBio').textContent = 
        currentUser.bio || 'No bio yet';
    
    // Update photos
    const photosGrid = document.getElementById('photosGrid');
    if (photosGrid && currentUser.photos) {
        photosGrid.innerHTML = currentUser.photos.map((photo, index) => `
            <div class="photo-item">
                <img src="${photo}" alt="Photo ${index + 1}">
            </div>
        `).join('');
    }
}

async function uploadPhoto() {
    document.getElementById('photoUpload').click();
}

async function handlePhotoUpload(event) {
    try {
        if (!currentUser) return;
        
        const file = event.target.files[0];
        if (!file) return;
        
        // Validate file
        if (!file.type.startsWith('image/')) {
            showNotification('Please select an image file', 'error');
            return;
        }
        
        if (file.size > 5 * 1024 * 1024) {
            showNotification('Image must be less than 5MB', 'error');
            return;
        }
        
        showNotification('Uploading photo...', 'info');
        
        // Upload to Firebase Storage
        const storageRef = storage.ref();
        const photoRef = storageRef.child(`users/${currentUser.uid}/${Date.now()}_${file.name}`);
        const uploadTask = await photoRef.put(file);
        const photoURL = await uploadTask.ref.getDownloadURL();
        
        // Update user's photos array
        const updatedPhotos = [...(currentUser.photos || []), photoURL];
        await db.collection('users').doc(currentUser.uid).update({
            photos: updatedPhotos
        });
        
        showNotification('Photo uploaded successfully!', 'success');
        
    } catch (error) {
        console.error('Photo upload error:', error);
        showNotification(error.message, 'error');
    }
}

async function editProfile() {
    // In a real app, you'd show an edit modal
    showNotification('Edit profile feature coming soon!', 'info');
}

// ===== NAVIGATION =====
function loadPage(pageName) {
    // Hide all pages
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    
    // Deactivate all nav links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    
    // Show selected page
    document.getElementById(pageName + 'Page').classList.add('active');
    
    // Activate selected nav link
    document.querySelector(`[onclick="loadPage('${pageName}')"]`).classList.add('active');
    
    // Load page-specific data
    switch(pageName) {
        case 'discover':
            loadProfiles();
            break;
        case 'matches':
            loadMatches();
            break;
        case 'messages':
            loadConversations();
            break;
        case 'profile':
            updateProfilePage();
            break;
    }
}

// ===== UTILITIES =====
function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    const text = document.getElementById('notificationText');
    
    // Set type-based styling
    notification.className = 'notification';
    if (type === 'success') {
        notification.style.background = 'var(--success)';
    } else if (type === 'error') {
        notification.style.background = 'var(--danger)';
    } else {
        notification.style.background = 'var(--primary)';
    }
    
    text.textContent = message;
    notification.classList.remove('hidden');
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
        notification.classList.add('hidden');
    }, 3000);
}

function formatTime(date) {
    if (!date) return '';
    
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) { // Less than 1 minute
        return 'Just now';
    } else if (diff < 3600000) { // Less than 1 hour
        const minutes = Math.floor(diff / 60000);
        return `${minutes}m ago`;
    } else if (diff < 86400000) { // Less than 1 day
        const hours = Math.floor(diff / 3600000);
        return `${hours}h ago`;
    } else if (diff < 604800000) { // Less than 1 week
        const days = Math.floor(diff / 86400000);
        return `${days}d ago`;
    } else {
        return date.toLocaleDateString();
    }
}

function updateMessagesBadge() {
    const totalUnread = conversations.reduce((sum, conv) => sum + conv.unreadCount, 0);
    const badge = document.getElementById('messagesBadge');
    if (badge) {
        badge.textContent = totalUnread;
        badge.style.display = totalUnread > 0 ? 'flex' : 'none';
    }
}

// ===== INITIALIZATION =====
// Check auth state on load
auth.onAuthStateChanged(async (user) => {
    if (user) {
        // User is signed in
        await initializeUserData(user.uid);
    } else {
        // User is signed out
        document.getElementById('app').classList.add('hidden');
        document.getElementById('authModal').classList.remove('hidden');
        showTab('login');
    }
});

// Initialize tab buttons
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            showTab(tab);
        });
    });
    
    // Handle enter key in chat
    document.getElementById('messageInput')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
});
