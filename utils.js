// Utility functions for the Lunch Restaurant website

/**
 * Export JavaScript object as JSON file
 * This allows admins to download the updated product data
 */
function exportToJsonFile(products, filename = 'products.json') {
    try {
        // Convert products array to JSON string with pretty formatting
        const jsonStr = JSON.stringify(products, null, 2);
        
        // Create a Blob object with the JSON string
        const blob = new Blob([jsonStr], { type: 'application/json' });
        
        // Create a temporary URL for the Blob
        const url = URL.createObjectURL(blob);
        
        // Create a download link element
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        
        // Programmatically click the link to trigger download
        document.body.appendChild(link);
        link.click();
        
        // Clean up
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        return true;
    } catch (error) {
        console.error('Error exporting JSON file:', error);
        return false;
    }
}

/**
 * Calculate discount percentage based on original and current prices
 */
function calculateDiscount(originalPrice, currentPrice) {
    if (!originalPrice || originalPrice <= 0 || currentPrice >= originalPrice) {
        return 0;
    }
    
    const discount = ((originalPrice - currentPrice) / originalPrice) * 100;
    return Math.round(discount);
}

/**
 * Validate product data before saving
 */
function validateProductData(productData) {
    const errors = [];
    
    // Check required fields
    const requiredFields = ['name', 'category', 'price', 'original_price', 'quantity', 'supplier', 'description', 'image_url'];
    
    for (const field of requiredFields) {
        if (!productData[field] || (typeof productData[field] === 'string' && productData[field].trim() === '')) {
            errors.push(`${field} is required`);
        }
    }
    
    // Check numeric values
    if (productData.price < 0) {
        errors.push('Price cannot be negative');
    }
    
    if (productData.original_price < 0) {
        errors.push('Original price cannot be negative');
    }
    
    if (productData.quantity < 0) {
        errors.push('Quantity cannot be negative');
    }
    
    if (productData.discount < 0 || productData.discount > 100) {
        errors.push('Discount must be between 0 and 100');
    }
    
    // Check URL format
    try {
        new URL(productData.image_url);
    } catch {
        errors.push('Image URL is not valid');
    }
    
    return {
        isValid: errors.length === 0,
        errors
    };
}

/**
 * Format price with currency symbol
 */
function formatPrice(price) {
    return `$${parseFloat(price).toFixed(2)}`;
}

/**
 * Show a notification message
 */
function showNotification(message, type = 'success') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    // Style notification
    Object.assign(notification.style, {
        position: 'fixed',
        top: '20px',
        right: '20px',
        padding: '15px 20px',
        borderRadius: '5px',
        color: 'white',
        fontWeight: 'bold',
        zIndex: '10000',
        boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
        backgroundColor: type === 'success' ? '#27ae60' : '#e74c3c',
        transition: 'opacity 0.3s ease, transform 0.3s ease',
        transform: 'translateX(100%)'
    });
    
    // Add to document
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 10);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

/**
 * Import this into admin.html to enhance functionality
 */
if (typeof window !== 'undefined') {
    window.utils = {
        exportToJsonFile,
        calculateDiscount,
        validateProductData,
        formatPrice,
        showNotification
    };
}