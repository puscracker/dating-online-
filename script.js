// ===== COMPLETE WORKING SCRIPT.JS =====

// Firebase services
let auth, db, currentUser = null;

// Initialize Firebase when page loads
document.addEventListener('DOMContentLoaded', function() {
    // Firebase configuration
    const firebaseConfig = {
        apiKey: "AIzaSyD6IindCvHymk6wJZdZKjftTCDmlhGGYcU",
        authDomain: "my-dating-app-ae675.firebaseapp.com",
        projectId: "my-dating-app-ae675",
        storageBucket: "my-dating-app-ae675.firebasestorage.app",
        messagingSenderId: "377976147228",
        appId: "1:377976147228:web:97ad2d5c4c3bad2d9ebed9",
        measurementId: "G-BCTNWGHN40"
    };

    // Initialize Firebase
    firebase.initializeApp(firebaseConfig);
    
    // Get services
    auth = firebase.auth();
    db = firebase.firestore();
    
    console.log("🔥 Firebase initialized!");
    
    // Check authentication state
    checkAuthState();
});

// ===== AUTHENTICATION =====
function checkAuthState() {
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            console.log("✅ User logged in:", user.email);
            currentUser = user;
            await loadUserData(user.uid);
            showApp();
        } else {
            console.log("❌ No user logged in");
            currentUser = null;
            showAuth();
        }
    });
}

async function signup() {
    try {
        const email = document.getElementById('signupEmail').value;
        const password = document.getElementById('signupPassword').value;
        const name = document.getElementById('signupName').value;
        const age = document.getElementById('signupAge').value;
        const gender = document.getElementById('signupGender').value;
        
        if (!email || !password || !name) {
            alert("Please fill all required fields");
            return;
        }
        
        // Create user account
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        // Save user profile
        await db.collection('users').doc(user.uid).set({
            uid: user.uid,
            name: name,
            email: email,
            age: parseInt(age) || 25,
            gender: gender || 'other',
            bio: '',
            photos: [],
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            lastActive: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        alert("🎉 Account created successfully!");
        
    } catch (error) {
        console.error("Signup error:", error);
        alert("Error: " + error.message);
    }
}

async function login() {
    try {
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        
        if (!email || !password) {
            alert("Please enter email and password");
            return;
        }
        
        await auth.signInWithEmailAndPassword(email, password);
        alert("✅ Logged in successfully!");
        
    } catch (error) {
        console.error("Login error:", error);
        alert("Error: " + error.message);
    }
}

function logout() {
    auth.signOut();
    alert("👋 Logged out");
}

// ===== USER DATA =====
async function loadUserData(userId) {
    try {
        const userDoc = await db.collection('users').doc(userId).get();
        if (userDoc.exists) {
            const userData = userDoc.data();
            console.log("User data loaded:", userData);
            
            // Update UI
            if (document.getElementById('profileName')) {
                document.getElementById('profileName').textContent = userData.name;
            }
            if (document.getElementById('userGreeting')) {
                document.getElementById('userGreeting').textContent = `Hello, ${userData.name}!`;
            }
        }
    } catch (error) {
        console.error("Error loading user data:", error);
    }
}

// ===== UI FUNCTIONS =====
function showApp() {
    document.getElementById('authModal').style.display = 'none';
    document.getElementById('app').style.display = 'block';
}

function showAuth() {
    document.getElementById('app').style.display = 'none';
    document.getElementById('authModal').style.display = 'flex';
}

function showTab(tabName) {
    // Hide all forms
    document.querySelectorAll('.auth-form').forEach(form => {
        form.style.display = 'none';
    });
    
    // Show selected form
    document.getElementById(tabName + 'Form').style.display = 'block';
}

// ===== INITIALIZE =====
// Make functions available globally
window.signup = signup;
window.login = login;
window.logout = logout;
window.showTab = showTab;
