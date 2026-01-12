const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
app.use(bodyParser.json());
app.use(cors());

// 导入数据库连接配置
const dbConfig = require('./db-config');

// MySQL 连接配置
const db = mysql.createConnection(dbConfig);

db.connect((err) => {
    if (err) console.error('Error connecting to MySQL:', err);
    else console.log('Connected to MySQL database');
});

// API 端点：保存订单
app.post('/save-order', (req, res) => {
    const { user_id, total_amount, items, shipping_address, payment_method, phone, email } = req.body;

    // 先插入订单主表
    const orderSql = `INSERT INTO orders (user_id, total_amount, shipping_address, payment_method, phone, email) VALUES (?, ?, ?, ?, ?, ?)`;
    db.query(orderSql, [user_id, total_amount, shipping_address, payment_method, phone, email], (err, result) => {
        if (err) {
            console.error('Error saving order:', err);
            return res.status(500).send('Error saving order');
        }

        const orderId = result.insertId; // 新订单ID

        // 插入订单项（items 是数组 [{product_id, product_name, quantity, unit_price}]）
        const itemSql = `INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, total_price) VALUES ?`;
        const itemValues = items.map(item => [orderId, item.product_id, item.product_name, item.quantity, item.unit_price, item.quantity * item.unit_price]);
        db.query(itemSql, [itemValues], (err) => {
            if (err) console.error('Error saving order items:', err);
            res.status(200).send('Order saved successfully');
        });
    });
});

app.listen(3000, () => console.log('Server running on port 3000'));