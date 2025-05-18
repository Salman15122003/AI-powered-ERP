from flask import Flask, render_template, request, jsonify, session, flash, redirect, url_for, send_file
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
import os
import csv
from datetime import datetime, timedelta
from dotenv import load_dotenv
from io import StringIO
import random
from sqlalchemy import text
import requests # Import the requests library

# Load environment variables
load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key-here'  # Change this in production
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///instance/erp.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

# Initialize database
db = SQLAlchemy(app)
login_manager = LoginManager(app)
login_manager.login_view = 'login'

# Database Models
class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password = db.Column(db.String(120), nullable=False)

class Product(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    price = db.Column(db.Float, nullable=False)
    stock = db.Column(db.Integer, nullable=False)
    category = db.Column(db.String(50))

class Sale(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.Integer, db.ForeignKey('product.id'), nullable=False)
    quantity = db.Column(db.Integer, nullable=False)
    total_price = db.Column(db.Float, nullable=False)
    date = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    product = db.relationship('Product', backref=db.backref('sales', lazy=True))

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

def populate_sample_data():
    # Sample product categories
    categories = ['Groceries', 'Electronics', 'Household', 'Beverages', 'Snacks']
    
    # Sample product names
    products_data = [
        ('Milk', 'Groceries', 3.99, 50),
        ('Bread', 'Groceries', 2.49, 30),
        ('Eggs', 'Groceries', 4.99, 40),
        ('Smartphone', 'Electronics', 699.99, 15),
        ('Laptop', 'Electronics', 1299.99, 10),
        ('Headphones', 'Electronics', 99.99, 25),
        ('Dish Soap', 'Household', 4.99, 35),
        ('Laundry Detergent', 'Household', 12.99, 20),
        ('Paper Towels', 'Household', 8.99, 45),
        ('Coffee', 'Beverages', 9.99, 30),
        ('Tea', 'Beverages', 5.99, 40),
        ('Orange Juice', 'Beverages', 4.99, 25),
        ('Chips', 'Snacks', 2.99, 60),
        ('Cookies', 'Snacks', 3.99, 55),
        ('Candy', 'Snacks', 1.99, 70)
    ]
    
    # Add products
    for name, category, price, stock in products_data:
        product = Product.query.filter_by(name=name).first()
        if not product:
            product = Product(
                name=name,
                category=category,
                price=price,
                stock=stock
            )
            db.session.add(product)
    
    db.session.commit()
    
    # Add sample sales
    products = Product.query.all()
    for _ in range(20):  # Create 20 sample sales
        product = random.choice(products)
        quantity = random.randint(1, 5)
        sale = Sale(
            product_id=product.id,
            quantity=quantity,
            total_price=product.price * quantity,
            date=datetime.utcnow() - timedelta(days=random.randint(0, 30))
        )
        db.session.add(sale)
    
    db.session.commit()

# Routes
@app.route('/')
@login_required
def index():
    return render_template('index.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        
        # For demo purposes, using hardcoded credentials
        if username == "admin" and password == "admin":
            user = User.query.filter_by(username=username).first()
            if not user:
                user = User(username=username, password=password)
                db.session.add(user)
                db.session.commit()
            login_user(user)
            return redirect(url_for('index'))
        flash('Invalid username or password', 'error')
    return render_template('login.html')

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('login'))

@app.route('/inventory')
@login_required
def inventory():
    products = Product.query.all()
    categories = db.session.query(Product.category).distinct().all()
    categories = [cat[0] for cat in categories if cat[0]]  # Remove None values
    return render_template('inventory.html', products=products, categories=categories)

@app.route('/api/products', methods=['GET'])
@login_required
def get_products():
    products = Product.query.all()
    return jsonify([{
        'id': p.id,
        'name': p.name,
        'price': p.price,
        'stock': p.stock,
        'category': p.category
    } for p in products])

@app.route('/api/products', methods=['POST'])
@login_required
def add_product():
    try:
        data = request.get_json()
        product = Product(
            name=data['name'],
            price=float(data['price']),
            stock=int(data['stock']),
            category=data.get('category', '')
        )
        db.session.add(product)
        db.session.commit()
        return jsonify({
            'id': product.id,
            'name': product.name,
            'price': product.price,
            'stock': product.stock,
            'category': product.category
        }), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/products/<int:product_id>', methods=['PUT'])
@login_required
def update_product(product_id):
    try:
        product = Product.query.get_or_404(product_id)
        data = request.get_json()
        
        if 'name' in data:
            product.name = data['name']
        if 'price' in data:
            product.price = float(data['price'])
        if 'stock' in data:
            product.stock = int(data['stock'])
        if 'category' in data:
            product.category = data['category']
        
        db.session.commit()
        return jsonify({
            'id': product.id,
            'name': product.name,
            'price': product.price,
            'stock': product.stock,
            'category': product.category
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/products/<int:product_id>', methods=['DELETE'])
@login_required
def delete_product(product_id):
    try:
        product = Product.query.get_or_404(product_id)
        db.session.delete(product)
        db.session.commit()
        return '', 204
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/products/import', methods=['POST'])
@login_required
def import_products():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    if not file.filename.endswith('.csv'):
        return jsonify({'error': 'File must be a CSV'}), 400
    
    try:
        stream = StringIO(file.stream.read().decode("UTF8"), newline=None)
        csv_reader = csv.DictReader(stream)
        
        for row in csv_reader:
            product = Product(
                name=row['name'],
                price=float(row['price']),
                stock=int(row['stock']),
                category=row.get('category', '')
            )
            db.session.add(product)
        
        db.session.commit()
        return jsonify({'message': 'Products imported successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400

@app.route('/api/products/export', methods=['GET'])
@login_required
def export_products():
    try:
        products = Product.query.all()
        
        si = StringIO()
        cw = csv.writer(si)
        cw.writerow(['name', 'price', 'stock', 'category'])
        
        for product in products:
            cw.writerow([product.name, product.price, product.stock, product.category])
        
        output = si.getvalue()
        si.close()
        
        return send_file(
            StringIO(output),
            mimetype='text/csv',
            as_attachment=True,
            download_name='products.csv'
        )
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/sales', methods=['GET'])
@login_required
def get_sales():
    sales = Sale.query.order_by(Sale.date.desc()).all()
    return jsonify([{
        'id': s.id,
        'product_id': s.product_id,
        'product_name': s.product.name,
        'quantity': s.quantity,
        'total_price': s.total_price,
        'date': s.date.isoformat()
    } for s in sales])

@app.route('/api/sales', methods=['POST'])
@login_required
def add_sale():
    try:
        data = request.get_json()
        product = Product.query.get_or_404(data['product_id'])
        
        if product.stock < data['quantity']:
            return jsonify({'error': 'Insufficient stock'}), 400
        
        sale = Sale(
            product_id=data['product_id'],
            quantity=data['quantity'],
            total_price=product.price * data['quantity']
        )
        
        product.stock -= data['quantity']
        
        db.session.add(sale)
        db.session.commit()
        
        return jsonify({
            'id': sale.id,
            'product_id': sale.product_id,
            'quantity': sale.quantity,
            'total_price': sale.total_price,
            'date': sale.date.isoformat()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400

@app.route('/api/chat', methods=['POST'])
@login_required
def chat():
    data = request.get_json()
    message = data.get('message', '')
    
    # --- n8n Webhook Configuration ---
    # **IMPORTANT:** Replace this with your actual n8n webhook URL
    n8n_webhook_url = "YOUR_N8N_WEBHOOK_URL_HERE"
    # -----------------------------------
    
    if not n8n_webhook_url or n8n_webhook_url == "YOUR_N8N_WEBHOOK_URL_HERE":
        return jsonify({'response': 'Error: n8n webhook URL is not configured.'}), 500
        
    try:
        # Forward message to n8n webhook
        n8n_response = requests.post(n8n_webhook_url, json={'message': message})
        n8n_response.raise_for_status() # Raise an exception for bad status codes
        
        # Get the response from n8n
        response_data = n8n_response.json()
        
        # Return the response from n8n to the frontend
        return jsonify({'response': response_data.get('response', 'No response from n8n')})
        
    except requests.exceptions.RequestException as e:
        print(f"Error communicating with n8n webhook: {e}")
        return jsonify({'response': f'Error communicating with AI assistant: {e}'}), 500
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        return jsonify({'response': f'An unexpected error occurred: {e}'}), 500

@app.route('/api/sales/monthly', methods=['GET'])
@login_required
def get_monthly_sales():
    # Get sales totals for each month in the last 12 months
    now = datetime.utcnow()
    months = [(now.replace(day=1) - timedelta(days=30*i)).strftime('%Y-%m') for i in range(11, -1, -1)]
    sales_by_month = {m: 0 for m in months}
    sales = Sale.query.all()
    for sale in sales:
        month = sale.date.strftime('%Y-%m')
        if month in sales_by_month:
            sales_by_month[month] += sale.total_price
    # Prepare data for chart
    labels = [datetime.strptime(m, '%Y-%m').strftime('%b %Y') for m in months]
    data = [round(sales_by_month[m], 2) for m in months]
    return jsonify({'labels': labels, 'data': data})

if __name__ == '__main__':
    with app.app_context():
        # Check if database exists and create if not
        if not os.path.exists('instance/erp.db'):
            print("Database file not found, creating database and populating data...")
            db.create_all()
            populate_sample_data()
            print("Database created and populated.")
        else:
             print("Database file found, creating missing tables.")
             db.create_all()
             # Optional: Add logic here to check for new tables/columns and migrate data if needed

    app.run(host='127.0.0.1', port=5000, debug=True) 