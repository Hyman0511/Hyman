// Authentication logic for customer login and registration

// Initialize users from localStorage or use default
function getUsers() {
    const usersData = localStorage.getItem('users');
    if (usersData) {
        return JSON.parse(usersData);
    }
    
    // Default user data
    const defaultUsers = {
        users: [
            {
                id: "1",
                username: "admin",
                email: "admin@example.com",
                password: "admin123",
                role: "admin",
                created_at: new Date().toISOString(),
                // Optional fields
                full_name: "Admin User",
                phone: "",
                address: "",
                date_of_birth: ""
            }
        ],
        last_id: 1
    };
    
    localStorage.setItem('users', JSON.stringify(defaultUsers));
    return defaultUsers;
}

// Save users data to localStorage
function saveUsers(usersData) {
    localStorage.setItem('users', JSON.stringify(usersData));
}

// Register new user
function registerUser(username, email, password, fullName = '', phone = '', address = '', dob = '') {
    const usersData = getUsers();
    
    // Check if email already exists
    const existingUser = usersData.users.find(user => user.email === email);
    if (existingUser) {
        return { success: false, message: 'Email already registered' };
    }
    
    // Check if username already exists
    const existingUsername = usersData.users.find(user => user.username === username);
    if (existingUsername) {
        return { success: false, message: 'Username already taken' };
    }
    
    // Create new user
    usersData.last_id++;
    const newUser = {
        id: usersData.last_id.toString(),
        username: username,
        email: email,
        password: password, // In a real app, we would hash this
        role: "customer",
        created_at: new Date().toISOString(),
        // Optional fields
        full_name: fullName.trim(),
        phone: phone.trim(),
        address: address.trim(),
        date_of_birth: dob
    };
    
    usersData.users.push(newUser);
    saveUsers(usersData);
    
    return { success: true, message: 'Registration successful!' };
}

// Login user
function loginUser(email, password) {
    const usersData = getUsers();
    
    // Find user by email
    const user = usersData.users.find(user => user.email === email);
    
    if (!user) {
        return { success: false, message: 'Invalid email or password' };
    }
    
    // Check password (in a real app, we would verify hashed password)
    if (user.password !== password) {
        return { success: false, message: 'Invalid email or password' };
    }
    
    // Store user session
    localStorage.setItem('currentUser', JSON.stringify({
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
    }));
    
    // Update navigation and dispatch auth event
    updateNavigation();
    
    return { 
        success: true, 
        message: 'Login successful!',
        user: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role
        }
    };
}

// Logout user
function logoutUser() {
    localStorage.removeItem('currentUser');
    updateNavigation();
    
    // Clear cart when user logs out
    if (window.cart && window.cart.clearCart) {
        window.cart.clearCart();
    }
    
    return true;
}

// Check if user is logged in
function isLoggedIn() {
    return localStorage.getItem('currentUser') !== null;
}

// Get current user
function getCurrentUser() {
    const userData = localStorage.getItem('currentUser');
    return userData ? JSON.parse(userData) : null;
}

// Password validation function
function validatePassword(password) {
    // At least 8 characters, contains a number and a special character
    const minLength = password.length >= 8;
    const hasNumber = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    return {
        isValid: minLength && hasNumber && hasSpecialChar,
        errors: [
            !minLength ? 'Password must be at least 8 characters long' : '',
            !hasNumber ? 'Password must contain at least one number' : '',
            !hasSpecialChar ? 'Password must contain at least one special character' : ''
        ].filter(Boolean)
    };
}

// Username validation function
function validateUsername(username) {
    const isValid = username.length >= 3 && username.length <= 20;
    return {
        isValid,
        error: !isValid ? 'Username must be 3-20 characters long' : ''
    };
}

// Initialize register form handling
function initRegisterForm() {
    const registerForm = document.getElementById('register-form');
    if (!registerForm) return;
    
    registerForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        // Required fields from the form
        const firstName = document.getElementById('first-name').value.trim();
        const lastName = document.getElementById('last-name').value.trim();
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirm-password').value;
        const terms = document.getElementById('terms').checked;
        
        // Optional fields
        const phone = document.getElementById('phone').value.trim();
        
        const errorMessage = document.getElementById('error-message');
        
        // Reset message
        errorMessage.style.display = 'none';
        
        // Validate first and last name
        if (!firstName || !lastName) {
            errorMessage.textContent = 'First name and last name are required';
            errorMessage.style.display = 'block';
            return;
        }
        
        // Create username from first and last name (make it unique if needed)
        const username = firstName.toLowerCase() + lastName.toLowerCase();
        
        // Validate password
        const passwordValidation = validatePassword(password);
        if (!passwordValidation.isValid) {
            errorMessage.textContent = passwordValidation.errors.join('\n');
            errorMessage.style.display = 'block';
            return;
        }
        
        // Check if passwords match
        if (password !== confirmPassword) {
            errorMessage.textContent = 'Passwords do not match';
            errorMessage.style.display = 'block';
            return;
        }
        
        // Check terms acceptance
        if (!terms) {
            errorMessage.textContent = 'You must accept the terms and conditions';
            errorMessage.style.display = 'block';
            return;
        }
        
        // Combine first and last name for full name
        const fullName = `${firstName} ${lastName}`;
        
        // Register user with all fields
        const result = registerUser(username, email, password, fullName, phone, '', '');
        
        if (result.success) {
            // Add success message
            const successMessage = document.createElement('div');
            successMessage.className = 'message success';
            successMessage.textContent = result.message;
            successMessage.style.display = 'block';
            registerForm.insertBefore(successMessage, registerForm.firstChild);
            
            // Clear form
            registerForm.reset();
            
            // Redirect to login page immediately without delay
            console.log('Registration successful, redirecting to login page...');
            window.location.href = 'login.html';
        } else {
            errorMessage.textContent = result.message;
            errorMessage.style.display = 'block';
        }
    });
}

// Initialize login form handling
function initLoginForm() {
    const loginForm = document.getElementById('login-form');
    if (!loginForm) return;
    
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const rememberMe = document.getElementById('remember')?.checked || false;
        
        const errorMessage = document.getElementById('error-message');
        
        // Reset message
        errorMessage.style.display = 'none';
        
        // Login user
        const result = loginUser(email, password);
        
        if (result.success) {
            // If remember me is checked, store a token (in a real app)
            if (rememberMe) {
                localStorage.setItem('remembered', 'true');
            }
            
            // Direct redirect to products page using assign method
            console.log('Login successful, redirecting to products page...');
            window.location.assign('products.html');
        } else {
            errorMessage.textContent = result.message;
            errorMessage.style.display = 'block';
        }
    });
}

// Update navigation based on login status
function updateNavigation() {
    const navLinks = document.querySelector('.nav-links');
    if (!navLinks) return;
    
    const currentUser = getCurrentUser();
    
    if (currentUser) {
        // User is logged in
        const loginLink = navLinks.querySelector('a[href="login.html"]');
        const registerLink = navLinks.querySelector('a[href="register.html"]');
        
        if (loginLink && registerLink) {
            // Replace login/register with profile/logout
            loginLink.textContent = `Welcome, ${currentUser.username}`;
            loginLink.href = 'javascript:void(0)';
            loginLink.style.cursor = 'default';
            
            registerLink.textContent = 'Logout';
            registerLink.href = 'javascript:void(0)';
            registerLink.onclick = () => {
                logoutUser();
                window.location.reload();
            };
        }
    }
    
    // Dispatch auth change event
    dispatchAuthChangeEvent();
}

// Dispatch auth change event
function dispatchAuthChangeEvent() {
    const event = new CustomEvent('authChanged', {
        detail: {
            isLoggedIn: isLoggedIn(),
            user: getCurrentUser()
        }
    });
    window.dispatchEvent(event);
}

// Initialize authentication on page load
document.addEventListener('DOMContentLoaded', () => {
    // Update navigation
    updateNavigation();
    
    // Initialize forms based on current page - more reliable method
    const currentURL = window.location.href;
    if (currentURL.includes('login.html')) {
        initLoginForm();
        console.log('Login form initialized');
    } else if (currentURL.includes('register.html')) {
        initRegisterForm();
        console.log('Register form initialized');
    }
});

// Export functions for use in other scripts
window.auth = {
    registerUser,
    loginUser,
    logoutUser,
    isLoggedIn,
    getCurrentUser,
    validatePassword,
    validateUsername,
    updateNavigation
};