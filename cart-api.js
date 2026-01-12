// 购物车后端API - 使用Node.js和Express
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// 导入数据库连接配置
const dbConfig = require('./db-config');

// 创建数据库连接池
const pool = mysql.createPool(dbConfig);

// 测试数据库连接
async function testDbConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('Database connection successful!');
    connection.release();
  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  }
}

testDbConnection();

// 创建购物车表（如果不存在）
async function createCartTable() {
  const query = `
    CREATE TABLE IF NOT EXISTS cart (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id VARCHAR(50) NOT NULL,
      product_id VARCHAR(50) NOT NULL,
      name VARCHAR(255) NOT NULL,
      price DECIMAL(10, 2) NOT NULL,
      original_price DECIMAL(10, 2) NOT NULL,
      discount DECIMAL(5, 2) DEFAULT 0,
      image_url VARCHAR(255) DEFAULT '',
      quantity INT NOT NULL DEFAULT 1,
      added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY user_product (user_id, product_id)
    );
  `;

  try {
    await pool.execute(query);
    console.log('Cart table created or already exists');
  } catch (error) {
    console.error('Error creating cart table:', error);
  }
}

createCartTable();

// API路由

// 获取购物车
app.get('/api/cart/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const [rows] = await pool.execute('SELECT * FROM cart WHERE user_id = ?', [userId]);
    res.json(rows);
  } catch (error) {
    console.error('Error getting cart:', error);
    res.status(500).json({ success: false, message: 'Error getting cart' });
  }
});

// 添加商品到购物车
app.post('/api/cart/add', async (req, res) => {
  try {
    const { product, quantity, userId } = req.body;
    
    // 检查商品是否已在购物车中
    const [existingItems] = await pool.execute(
      'SELECT * FROM cart WHERE user_id = ? AND product_id = ?',
      [userId, product.id]
    );

    if (existingItems.length > 0) {
      // 更新数量
      const newQuantity = existingItems[0].quantity + quantity;
      await pool.execute(
        'UPDATE cart SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND product_id = ?',
        [newQuantity, userId, product.id]
      );
      
      res.json({ success: true, message: 'Cart item quantity updated', newQuantity });
    } else {
      // 添加新商品
      await pool.execute(
        'INSERT INTO cart (user_id, product_id, name, price, original_price, discount, image_url, quantity) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [
          userId,
          product.id,
          product.name,
          product.price,
          product.original_price || product.price,
          product.discount || 0,
          product.image_url || '',
          quantity
        ]
      );
      
      res.json({ success: true, message: 'Product added to cart' });
    }
  } catch (error) {
    console.error('Error adding to cart:', error);
    res.status(500).json({ success: false, message: 'Error adding to cart' });
  }
});

// 从购物车删除商品
app.delete('/api/cart/remove/:userId/:productId', async (req, res) => {
  try {
    const { userId, productId } = req.params;
    await pool.execute(
      'DELETE FROM cart WHERE user_id = ? AND product_id = ?',
      [userId, productId]
    );
    
    res.json({ success: true, message: 'Product removed from cart' });
  } catch (error) {
    console.error('Error removing from cart:', error);
    res.status(500).json({ success: false, message: 'Error removing from cart' });
  }
});

// 更新购物车商品数量
app.put('/api/cart/update/:userId/:productId', async (req, res) => {
  try {
    const { userId, productId } = req.params;
    const { quantity } = req.body;
    
    await pool.execute(
      'UPDATE cart SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND product_id = ?',
      [quantity, userId, productId]
    );
    
    res.json({ success: true, message: 'Cart item quantity updated' });
  } catch (error) {
    console.error('Error updating cart item:', error);
    res.status(500).json({ success: false, message: 'Error updating cart item' });
  }
});

// 清空购物车
app.delete('/api/cart/clear/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    await pool.execute('DELETE FROM cart WHERE user_id = ?', [userId]);
    
    res.json({ success: true, message: 'Cart cleared' });
  } catch (error) {
    console.error('Error clearing cart:', error);
    res.status(500).json({ success: false, message: 'Error clearing cart' });
  }
});

// 获取购物车总金额
app.get('/api/cart/total/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const [rows] = await pool.execute(
      'SELECT SUM(price * quantity) as total FROM cart WHERE user_id = ?',
      [userId]
    );
    
    res.json({ success: true, total: rows[0].total || 0 });
  } catch (error) {
    console.error('Error calculating cart total:', error);
    res.status(500).json({ success: false, message: 'Error calculating cart total' });
  }
});

// 获取购物车商品数量
app.get('/api/cart/count/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const [rows] = await pool.execute(
      'SELECT SUM(quantity) as count FROM cart WHERE user_id = ?',
      [userId]
    );
    
    res.json({ success: true, count: rows[0].count || 0 });
  } catch (error) {
    console.error('Error getting cart count:', error);
    res.status(500).json({ success: false, message: 'Error getting cart count' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Cart API server running on port ${PORT}`);
});
