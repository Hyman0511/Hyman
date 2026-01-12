// 购物车功能核心模块 - 支持后端API和localStorage回退

// API基础URL
const API_BASE_URL = 'http://localhost:3000/api/cart';
// API是否可用的标志
let apiAvailable = true;

/**
 * 检查API是否可用
 * @returns {Promise<boolean>} API是否可用
 */
async function checkApiAvailability() {
    try {
        const response = await fetch(`${API_BASE_URL}/guest`, { method: 'HEAD' });
        apiAvailable = response.ok;
        return apiAvailable;
    } catch (error) {
        apiAvailable = false;
        console.warn('API unavailable, falling back to localStorage:', error);
        return false;
    }
}

// 初始检查API可用性
checkApiAvailability();

/**
 * 获取当前用户的购物车
 * @param {string} userId - 用户ID，默认为'guest'
 * @returns {Array} 购物车商品列表
 */
async function getCart(userId = 'guest') {
    try {
        // 验证用户ID
        const userIdResult = validateUserId(userId);
        const validUserId = userIdResult.valid ? userIdResult.userId : 'guest';
        
        // 如果API可用，尝试从API获取购物车
        if (apiAvailable) {
            const response = await fetch(`${API_BASE_URL}/${validUserId}`);
            
            if (response.ok) {
                const cart = await response.json();
                
                // 确保返回的是数组且包含有效的购物车项
                if (Array.isArray(cart)) {
                    // 转换数据库字段名以匹配前端使用习惯
                    return cart.map(item => ({
                        id: item.product_id,
                        name: item.name,
                        price: parseFloat(item.price),
                        original_price: parseFloat(item.original_price),
                        discount: parseFloat(item.discount),
                        image_url: item.image_url,
                        quantity: item.quantity,
                        addedAt: item.added_at,
                        updatedAt: item.updated_at
                    }));
                }
            } else {
                // API返回错误，切换到localStorage
                apiAvailable = false;
                console.warn('API error, falling back to localStorage');
            }
        }
        
        // API不可用或返回错误，使用localStorage
        return getCartFromLocalStorage(validUserId);
    } catch (error) {
        console.error('Error getting cart:', error);
        // 发生错误时，使用localStorage
        const userIdResult = validateUserId(userId);
        const validUserId = userIdResult.valid ? userIdResult.userId : 'guest';
        return getCartFromLocalStorage(validUserId);
    }
}

/**
 * 从localStorage获取购物车
 * @param {string} userId - 用户ID
 * @returns {Array} 购物车商品列表
 */
function getCartFromLocalStorage(userId) {
    try {
        const cartData = localStorage.getItem(`cart_${userId}`);
        
        if (!cartData) {
            return [];
        }
        
        // 使用安全的JSON解析
        const cart = safeJSONParse(cartData, []);
        
        // 确保返回的是数组且包含有效的购物车项
        if (!Array.isArray(cart)) {
            console.warn('Cart data is not an array, returning empty cart');
            return [];
        }
        
        // 清理无效的购物车项
        return cart.filter(item => {
            return item && 
                   typeof item.id === 'string' && 
                   typeof item.quantity === 'number' && 
                   item.quantity > 0;
        });
    } catch (error) {
        console.error('Error getting cart from localStorage:', error);
        return [];
    }
}

/**
 * 保存购物车到后端数据库
 * 注意：这个函数在API版本中不再直接使用，而是通过各个操作函数分别调用API
 * @param {Array} cart - 购物车商品列表
 * @param {string} userId - 用户ID，默认为'guest'
 * @returns {boolean} 保存是否成功
 */
function saveCart(cart, userId = 'guest') {
    // 在API版本中，这个函数不再直接使用，因为每个操作都通过API单独保存
    console.warn('saveCart function is deprecated in API version');
    return true;
}

/**
 * 添加商品到购物车
 * @param {Object} product - 商品对象
 * @param {number} quantity - 数量
 * @param {string} userId - 用户ID，默认为'guest'
 * @returns {Object} 操作结果
 */
async function addToCart(product, quantity = 1, userId = 'guest') {
    try {
        // 使用增强的验证函数
        const validationResult = validateProductData(product);
        if (!validationResult.isValid) {
            console.error('Product validation failed:', validationResult.message);
            return { success: false, message: validationResult.message };
        }
        
        // 验证数量
        const quantityResult = validateQuantity(quantity);
        if (!quantityResult.valid) {
            console.error('Quantity validation failed:', quantityResult.message);
            return { success: false, message: quantityResult.message };
        }
        
        // 验证用户ID
        const userIdResult = validateUserId(userId);
        if (!userIdResult.valid) {
            console.error('User ID validation failed:', userIdResult.message);
            return { success: false, message: userIdResult.message };
        }
        
        // 获取验证后的参数
        const validQuantity = quantityResult.value;
        const validUserId = userIdResult.userId;
        
        // 尝试调用API添加商品到购物车
        if (apiAvailable) {
            try {
                const response = await fetch(`${API_BASE_URL}/add`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        product: {
                            id: String(product.id),
                            name: String(product.name || 'Unnamed Product'),
                            price: parseFloat(product.price || 0),
                            original_price: parseFloat(product.original_price || product.price || 0),
                            discount: parseFloat(product.discount || 0),
                            image_url: String(product.image_url || '')
                        },
                        quantity: validQuantity,
                        userId: validUserId
                    })
                });
                
                if (response.ok) {
                    const result = await response.json();
                    
                    if (result.success) {
                        // 获取更新后的购物车数据
                        const cart = await getCart(validUserId);
                        const totalQuantity = await getCartItemCount(validUserId);
                        updateCartCount(validUserId);
                        
                        return { 
                            success: true, 
                            message: result.message || 'Product added to cart successfully',
                            cart: cart,
                            itemCount: totalQuantity,
                            totalItems: cart.length
                        };
                    }
                } else {
                    console.warn('API call failed, falling back to localStorage');
                }
            } catch (apiError) {
                console.warn('API call exception, falling back to localStorage:', apiError);
            }
        }
        
        // API不可用或失败，使用localStorage添加商品
        return addToCartLocalStorage(product, validQuantity, validUserId);
    } catch (error) {
        console.error('Error adding product to cart:', error);
        return { success: false, message: 'An error occurred while adding to cart: ' + (error.message || 'Unknown error') };
    }
}

/**
 * 使用localStorage添加商品到购物车
 * @param {Object} product - 商品对象
 * @param {number} quantity - 数量
 * @param {string} userId - 用户ID
 * @returns {Object} 操作结果
 */
function addToCartLocalStorage(product, quantity, userId) {
    try {
        // 获取当前购物车数据
        const cart = getCartFromLocalStorage(userId);
        
        // 检查商品是否已存在于购物车
        const existingItemIndex = cart.findIndex(item => item.id === String(product.id));
        
        if (existingItemIndex !== -1) {
            // 商品已存在，更新数量
            cart[existingItemIndex].quantity += quantity;
        } else {
            // 商品不存在，添加新商品
            cart.push({
                id: String(product.id),
                name: String(product.name || 'Unnamed Product'),
                price: parseFloat(product.price || 0),
                original_price: parseFloat(product.original_price || product.price || 0),
                discount: parseFloat(product.discount || 0),
                image_url: String(product.image_url || ''),
                quantity: quantity,
                addedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
        }
        
        // 保存更新后的购物车到localStorage
        localStorage.setItem(`cart_${userId}`, JSON.stringify(cart));
        
        // 更新购物车数量显示
        updateCartCount(userId);
        
        // 触发购物车更新事件
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('cartUpdated', { 
                detail: { userId: userId, itemCount: getCartItemCount(userId) } 
            }));
        }
        
        const totalQuantity = cart.reduce((total, item) => total + item.quantity, 0);
        
        return { 
            success: true, 
            message: 'Product added to cart successfully',
            cart: cart,
            itemCount: totalQuantity,
            totalItems: cart.length
        };
    } catch (error) {
        console.error('Error adding product to localStorage cart:', error);
        return { success: false, message: 'Failed to add product to cart' };
    }
}

/**
 * 从购物车中删除商品
 * @param {string} productId - 商品ID
 * @param {string} userId - 用户ID，默认为'guest'
 * @returns {Object} 操作结果
 */
async function removeFromCart(productId, userId = 'guest') {
    try {
        // 验证产品ID
        if (!productId || typeof productId !== 'string') {
            return { success: false, message: 'Invalid product ID' };
        }
        
        // 验证用户ID
        const userIdResult = validateUserId(userId);
        if (!userIdResult.valid) {
            return { success: false, message: userIdResult.message };
        }
        
        const validUserId = userIdResult.userId;
        
        // 尝试调用API删除商品
        if (apiAvailable) {
            try {
                const response = await fetch(`${API_BASE_URL}/remove/${validUserId}/${productId}`, {
                    method: 'DELETE'
                });
                
                if (response.ok) {
                    const result = await response.json();
                    
                    if (result.success) {
                        // 获取更新后的购物车数据
                        const cart = await getCart(validUserId);
                        const totalQuantity = await getCartItemCount(validUserId);
                        updateCartCount(validUserId);
                        
                        return { 
                            success: true, 
                            message: result.message || 'Product removed from cart successfully',
                            cart: cart,
                            itemCount: totalQuantity,
                            remainingItems: cart.length
                        };
                    }
                } else {
                    console.warn('API call failed, falling back to localStorage');
                }
            } catch (apiError) {
                console.warn('API call exception, falling back to localStorage:', apiError);
            }
        }
        
        // API不可用或失败，使用localStorage删除商品
        return removeFromCartLocalStorage(productId, validUserId);
    } catch (error) {
        console.error('Error removing product from cart:', error);
        return { success: false, message: 'An error occurred while removing from cart: ' + (error.message || 'Unknown error') };
    }
}

/**
 * 使用localStorage从购物车中删除商品
 * @param {string} productId - 商品ID
 * @param {string} userId - 用户ID
 * @returns {Object} 操作结果
 */
function removeFromCartLocalStorage(productId, userId) {
    try {
        // 获取当前购物车数据
        const cart = getCartFromLocalStorage(userId);
        
        // 找到要删除的商品
        const itemIndex = cart.findIndex(item => item.id === String(productId));
        
        if (itemIndex === -1) {
            return { success: false, message: 'Product not found in cart' };
        }
        
        // 删除商品
        cart.splice(itemIndex, 1);
        
        // 保存更新后的购物车到localStorage
        localStorage.setItem(`cart_${userId}`, JSON.stringify(cart));
        
        // 更新购物车数量显示
        updateCartCount(userId);
        
        // 触发购物车更新事件
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('cartUpdated', { 
                detail: { userId: userId, itemCount: cart.reduce((total, item) => total + item.quantity, 0) } 
            }));
        }
        
        const totalQuantity = cart.reduce((total, item) => total + item.quantity, 0);
        
        return { 
            success: true, 
            message: 'Product removed from cart successfully',
            cart: cart,
            itemCount: totalQuantity,
            remainingItems: cart.length
        };
    } catch (error) {
        console.error('Error removing product from localStorage cart:', error);
        return { success: false, message: 'Failed to remove product from cart' };
    }
}

/**
 * 更新购物车中商品的数量
 * @param {string} productId - 商品ID
 * @param {number} quantity - 新数量
 * @param {string} userId - 用户ID，默认为'guest'
 * @returns {Object} 操作结果
 */
async function updateCartItemQuantity(productId, quantity, userId = 'guest') {
    try {
        // 验证产品ID
        if (!productId || typeof productId !== 'string') {
            return { success: false, message: 'Invalid product ID' };
        }
        
        // 验证数量
        const quantityResult = validateQuantity(quantity);
        if (!quantityResult.valid) {
            return { success: false, message: quantityResult.message };
        }
        
        // 验证用户ID
        const userIdResult = validateUserId(userId);
        if (!userIdResult.valid) {
            return { success: false, message: userIdResult.message };
        }
        
        // 获取验证后的参数
        const validQuantity = quantityResult.value;
        const validUserId = userIdResult.userId;
        
        // 尝试调用API更新商品数量
        if (apiAvailable) {
            try {
                const response = await fetch(`${API_BASE_URL}/update/${validUserId}/${productId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ quantity: validQuantity })
                });
                
                if (response.ok) {
                    const result = await response.json();
                    
                    if (result.success) {
                        // 获取更新后的购物车数据
                        const cart = await getCart(validUserId);
                        const totalQuantity = await getCartItemCount(validUserId);
                        updateCartCount(validUserId);
                        
                        return { 
                            success: true, 
                            message: result.message || 'Cart item quantity updated successfully',
                            cart: cart,
                            itemCount: totalQuantity,
                            newQuantity: validQuantity
                        };
                    }
                } else {
                    console.warn('API call failed, falling back to localStorage');
                }
            } catch (apiError) {
                console.warn('API call exception, falling back to localStorage:', apiError);
            }
        }
        
        // API不可用或失败，使用localStorage更新商品数量
        return updateCartItemQuantityLocalStorage(productId, validQuantity, validUserId);
    } catch (error) {
        console.error('Error updating cart item quantity:', error);
        return { success: false, message: 'An error occurred while updating cart: ' + (error.message || 'Unknown error') };
    }
}

/**
 * 使用localStorage更新购物车中商品的数量
 * @param {string} productId - 商品ID
 * @param {number} quantity - 新数量
 * @param {string} userId - 用户ID
 * @returns {Object} 操作结果
 */
function updateCartItemQuantityLocalStorage(productId, quantity, userId) {
    try {
        // 获取当前购物车数据
        const cart = getCartFromLocalStorage(userId);
        
        // 找到要更新的商品
        const itemIndex = cart.findIndex(item => item.id === String(productId));
        
        if (itemIndex === -1) {
            return { success: false, message: 'Product not found in cart' };
        }
        
        // 更新商品数量
        cart[itemIndex].quantity = quantity;
        cart[itemIndex].updatedAt = new Date().toISOString();
        
        // 保存更新后的购物车到localStorage
        localStorage.setItem(`cart_${userId}`, JSON.stringify(cart));
        
        // 更新购物车数量显示
        updateCartCount(userId);
        
        // 触发购物车更新事件
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('cartUpdated', { 
                detail: { userId: userId, itemCount: cart.reduce((total, item) => total + item.quantity, 0) } 
            }));
        }
        
        const totalQuantity = cart.reduce((total, item) => total + item.quantity, 0);
        
        return { 
            success: true, 
            message: 'Cart item quantity updated successfully',
            cart: cart,
            itemCount: totalQuantity,
            newQuantity: quantity
        };
    } catch (error) {
        console.error('Error updating cart item quantity in localStorage:', error);
        return { success: false, message: 'Failed to update cart item quantity' };
    }
}

/**
 * 清空购物车
 * @param {string} userId - 用户ID，默认为'guest'
 * @returns {Object} 操作结果
 */
async function clearCart(userId = 'guest') {
    try {
        // 验证用户ID
        const userIdResult = validateUserId(userId);
        const validUserId = userIdResult.valid ? userIdResult.userId : 'guest';
        
        // 尝试调用API清空购物车
        if (apiAvailable) {
            try {
                const response = await fetch(`${API_BASE_URL}/clear/${validUserId}`, {
                    method: 'DELETE'
                });
                
                if (response.ok) {
                    const result = await response.json();
                    
                    if (result.success) {
                        // 触发自定义事件
                        if (typeof window !== 'undefined') {
                            window.dispatchEvent(new CustomEvent('cartUpdated', { 
                                detail: { userId: validUserId, itemCount: 0 } 
                            }));
                        }
                        
                        updateCartCount(validUserId);
                        
                        return { 
                            success: true, 
                            message: result.message || 'Cart cleared successfully',
                            cart: [],
                            itemCount: 0
                        };
                    }
                } else {
                    console.warn('API call failed, falling back to localStorage');
                }
            } catch (apiError) {
                console.warn('API call exception, falling back to localStorage:', apiError);
            }
        }
        
        // API不可用或失败，使用localStorage清空购物车
        return clearCartLocalStorage(validUserId);
    } catch (error) {
        console.error('Error clearing cart:', error);
        return { success: false, message: 'An error occurred while clearing cart: ' + (error.message || 'Unknown error') };
    }
}

/**
 * 使用localStorage清空购物车
 * @param {string} userId - 用户ID
 * @returns {Object} 操作结果
 */
function clearCartLocalStorage(userId) {
    try {
        // 从localStorage中移除购物车数据
        localStorage.removeItem(`cart_${userId}`);
        
        // 更新购物车数量显示
        updateCartCount(userId);
        
        // 触发购物车更新事件
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('cartUpdated', { 
                detail: { userId: userId, itemCount: 0 } 
            }));
        }
        
        return { 
            success: true, 
            message: 'Cart cleared successfully',
            cart: [],
            itemCount: 0
        };
    } catch (error) {
        console.error('Error clearing localStorage cart:', error);
        return { success: false, message: 'Failed to clear cart' };
    }
}

/**
 * 计算购物车总价
 * @param {string} userId - 用户ID，默认为'guest'
 * @returns {number} 购物车总价
 */
async function calculateCartTotal(userId = 'guest') {
    try {
        // 验证用户ID
        const userIdResult = validateUserId(userId);
        const validUserId = userIdResult.valid ? userIdResult.userId : 'guest';
        
        // 调用API获取购物车总价
        const response = await fetch(`${API_BASE_URL}/total/${validUserId}`);
        
        if (!response.ok) {
            throw new Error('Failed to calculate cart total');
        }
        
        const result = await response.json();
        
        if (result.success) {
            return parseFloat(result.total);
        } else {
            throw new Error(result.message || 'Failed to get cart total');
        }
    } catch (error) {
        console.error('Error calculating cart total:', error);
        // 如果API调用失败，回退到前端计算
        try {
            const cart = await getCart(userId);
            return cart.reduce((total, item) => {
                if (!item || typeof item.price !== 'number' || typeof item.quantity !== 'number') {
                    return total;
                }
                
                let price = item.price;
                if (typeof item.discount === 'number' && item.discount > 0 && item.discount <= 100) {
                    price = item.price * (1 - item.discount / 100);
                }
                
                return total + (price * item.quantity);
            }, 0);
        } catch (fallbackError) {
            console.error('Fallback calculation also failed:', fallbackError);
            return 0;
        }
    }
}

/**
 * 获取购物车中的商品数量
 * @param {string} userId - 用户ID，默认为'guest'
 * @returns {number} 购物车中的商品数量
 */
async function getCartItemCount(userId = 'guest') {
    try {
        // 验证用户ID
        const userIdResult = validateUserId(userId);
        const validUserId = userIdResult.valid ? userIdResult.userId : 'guest';
        
        // 调用API获取购物车商品数量
        const response = await fetch(`${API_BASE_URL}/count/${validUserId}`);
        
        if (!response.ok) {
            throw new Error('Failed to get cart item count');
        }
        
        const result = await response.json();
        
        if (result.success) {
            return parseInt(result.count) || 0;
        } else {
            throw new Error(result.message || 'Failed to get cart count');
        }
    } catch (error) {
        console.error('Error getting cart item count:', error);
        // 如果API调用失败，回退到前端计算
        try {
            const cart = await getCart(userId);
            return cart.reduce((total, item) => {
                if (item && typeof item.quantity === 'number') {
                    return total + item.quantity;
                }
                return total;
            }, 0);
        } catch (fallbackError) {
            console.error('Fallback calculation also failed:', fallbackError);
            return 0;
        }
    }
}

// 更新购物车数量显示
function updateCartCount(userId = 'guest') {
    try {
        // 确保在浏览器环境中运行
        if (typeof window === 'undefined' || typeof document === 'undefined') {
            return;
        }
        
        // 获取购物车数量
        const itemCount = getCartItemCount(userId);
        
        // 更新页面中的购物车计数
        const cartCountElements = document.querySelectorAll('.cart-count');
        
        if (cartCountElements.length > 0) {
            cartCountElements.forEach(element => {
                try {
                    element.textContent = itemCount;
                    // 如果购物车为空，隐藏数量标记
                    element.style.display = itemCount > 0 ? 'flex' : 'none';
                } catch (e) {
                    console.warn('Failed to update individual cart count element:', e);
                }
            });
        }
    } catch (error) {
        console.error('Error updating cart count display:', error);
    }
}

// 监听localStorage变化，以便在多个标签页间同步购物车
function setupStorageSync() {
    if (typeof window !== 'undefined') {
        window.addEventListener('storage', (event) => {
            if (event.key && event.key.startsWith('cart_')) {
                console.log('Cart data changed in another tab, updating UI');
                updateCartCount();
            }
        });
        
        // 监听购物车更新事件
        window.addEventListener('cartUpdated', (event) => {
            console.log('Cart updated event received');
            updateCartCount(event.detail?.userId);
        });
    }
}

// 初始化购物车功能
function initCart() {
    // 设置存储同步
    setupStorageSync();
    // 初始更新购物车数量显示
    updateCartCount();
    console.log('Shopping cart initialized successfully');
}

/**
 * 验证购物车商品数据
 * @param {Object} product - 商品对象
 * @returns {Object} 验证结果
 */
function validateProductData(product) {
    // 检查product是否是对象且非数组
    if (!product || typeof product !== 'object' || Array.isArray(product)) {
        return { isValid: false, message: 'Invalid product data: product must be an object' };
    }
    
    // 检查必要字段
    const requiredFields = ['id', 'name', 'price'];
    for (const field of requiredFields) {
        if (!product.hasOwnProperty(field) || product[field] === null || product[field] === undefined) {
            return { isValid: false, message: `Invalid product data: missing required field '${field}'` };
        }
    }
    
    // 验证ID
    const productId = String(product.id).trim();
    if (productId === '') {
        return { isValid: false, message: 'Invalid product data: id must be a non-empty string' };
    }
    
    // 验证名称
    const productName = String(product.name).trim();
    if (productName === '') {
        return { isValid: false, message: 'Invalid product data: name must be a non-empty string' };
    }
    if (productName.length > 100) {
        return { isValid: false, message: 'Invalid product data: name must not exceed 100 characters' };
    }
    
    // 验证价格
    const price = parseFloat(product.price);
    if (isNaN(price) || price < 0 || price > 999999) {
        return { isValid: false, message: 'Invalid product data: price must be a non-negative number and not exceed 999999' };
    }
    
    // 验证可选字段
    if (product.image_url && typeof product.image_url !== 'string') {
        return { isValid: false, message: 'Invalid product data: image_url must be a string' };
    }
    
    if (product.original_price !== undefined) {
        const originalPrice = parseFloat(product.original_price);
        if (isNaN(originalPrice) || originalPrice < 0 || originalPrice > 999999) {
            return { isValid: false, message: 'Invalid product data: original_price must be a non-negative number' };
        }
    }
    
    if (product.discount !== undefined) {
        const discount = parseFloat(product.discount);
        if (isNaN(discount) || discount < 0 || discount > 100) {
            return { isValid: false, message: 'Invalid product data: discount must be a number between 0 and 100' };
        }
    }
    
    return { isValid: true, message: 'Product data is valid' };
}

// 数量验证函数
function validateQuantity(quantity) {
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty < 1 || qty > 99) {
        return { valid: false, message: 'Invalid quantity: must be a whole number between 1 and 99' };
    }
    return { valid: true, value: qty };
}

// 用户ID验证函数
function validateUserId(userId) {
    if (!userId || typeof userId !== 'string') {
        return { valid: false, message: 'Invalid user ID: must be a string' };
    }
    const trimmedUserId = userId.trim();
    if (trimmedUserId === '') {
        return { valid: false, message: 'Invalid user ID: cannot be empty' };
    }
    if (trimmedUserId.length > 50) {
        return { valid: false, message: 'Invalid user ID: cannot exceed 50 characters' };
    }
    return { valid: true, userId: trimmedUserId };
}

// 安全JSON解析函数
function safeJSONParse(jsonString, defaultValue = null) {
    try {
        return JSON.parse(jsonString);
    } catch (error) {
        console.error('Error parsing JSON:', error);
        return defaultValue;
    }
}

// 导出购物车功能供其他文件使用
window.cart = {
    getCart,
    saveCart,
    addToCart,
    removeFromCart,
    updateCartItemQuantity,
    clearCart,
    calculateCartTotal,
    getCartItemCount,
    validateProductData,
    updateCartCount,
    initCart
};

// 自动初始化购物车功能（仅在浏览器环境中）
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initCart);
    } else {
        // 页面已经加载完成，直接初始化
        initCart();
    }
}