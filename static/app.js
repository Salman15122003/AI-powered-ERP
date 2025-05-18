// Global variables
let currentUser = null;
let notifications = [];
let currentPage = 1;
const itemsPerPage = 10;
let searchTimeout;

// DOM Elements
const searchInput = document.getElementById('searchInput');
const categoryFilter = document.getElementById('categoryFilter');
const productTable = document.getElementById('productTable');
const productTableBody = document.getElementById('productTableBody');
const pagination = document.getElementById('pagination');
const loadingSpinner = document.getElementById('loadingSpinner');

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
    startRealTimeUpdates();
});

// Initialize application features
function initializeApp() {
    // Add loading animations
    document.querySelectorAll('.card').forEach(card => {
        card.classList.add('fade-in');
    });

    // Initialize tooltips
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });

    // Add hover effects to table rows
    document.querySelectorAll('tbody tr').forEach(row => {
        row.addEventListener('mouseenter', function() {
            this.classList.add('table-hover');
        });
        row.addEventListener('mouseleave', function() {
            this.classList.remove('table-hover');
        });
    });

    loadProducts();
    setupToastSystem();
    setupThemeToggle();
}

// Setup event listeners
function setupEventListeners() {
    // Form validation
    document.querySelectorAll('form').forEach(form => {
        form.addEventListener('submit', function(e) {
            if (!this.checkValidity()) {
                e.preventDefault();
                e.stopPropagation();
            }
            this.classList.add('was-validated');
        });
    });

    // Add smooth scrolling
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            document.querySelector(this.getAttribute('href')).scrollIntoView({
                behavior: 'smooth'
            });
        });
    });

    if (searchInput) {
        searchInput.addEventListener('input', handleSearch);
    }
    if (categoryFilter) {
        categoryFilter.addEventListener('change', handleCategoryFilter);
    }
}

// Real-time updates
function startRealTimeUpdates() {
    // Update dashboard stats every 30 seconds
    setInterval(updateDashboardStats, 30000);
    
    // Check for low stock items every minute
    setInterval(checkLowStock, 60000);
}

// Update dashboard statistics
function updateDashboardStats() {
    fetch('/api/products')
        .then(response => response.json())
        .then(products => {
            updateProductStats(products);
            updateLowStockAlerts(products);
        })
        .catch(error => console.error('Error updating stats:', error));

    fetch('/api/sales')
        .then(response => response.json())
        .then(sales => {
            updateSalesStats(sales);
        })
        .catch(error => console.error('Error updating sales:', error));
}

// Update product statistics with animation
function updateProductStats(products) {
    const totalProducts = document.getElementById('total-products');
    const lowStock = document.getElementById('low-stock');
    
    if (totalProducts && lowStock) {
        animateValue(totalProducts, parseInt(totalProducts.textContent), products.length);
        animateValue(lowStock, parseInt(lowStock.textContent), products.filter(p => p.stock < 10).length);
    }
}

// Update sales statistics
function updateSalesStats(sales) {
    const totalSales = document.getElementById('total-sales');
    const recentSales = document.getElementById('recent-sales');
    
    if (totalSales) {
        animateValue(totalSales, parseInt(totalSales.textContent), sales.length);
    }
    
    if (recentSales) {
        updateRecentSalesTable(sales);
    }
}

// Update low stock alerts
function updateLowStockAlerts(products) {
    const alertsDiv = document.getElementById('low-stock-alerts');
    if (!alertsDiv) return;

    const lowStockProducts = products.filter(p => p.stock < 10);
    
    if (lowStockProducts.length === 0) {
        alertsDiv.innerHTML = '<p class="text-success">No low stock items</p>';
    } else {
        alertsDiv.innerHTML = lowStockProducts.map(p => `
            <div class="alert alert-warning fade-in">
                <strong>${p.name}</strong>: Only ${p.stock} items left
                <button type="button" class="btn btn-sm btn-warning float-end" 
                        onclick="restockProduct(${p.id})">
                    Restock
                </button>
            </div>
        `).join('');
    }
}

// Update recent sales table
function updateRecentSalesTable(sales) {
    const salesTable = document.getElementById('recent-sales');
    if (!salesTable) return;

    if (sales.length === 0) {
        salesTable.innerHTML = '<tr><td colspan="4" class="text-center">No sales recorded</td></tr>';
    } else {
        salesTable.innerHTML = sales.slice(0, 5).map(sale => `
            <tr class="fade-in">
                <td>${new Date(sale.date).toLocaleDateString()}</td>
                <td>Product ID: ${sale.product_id}</td>
                <td>${sale.quantity}</td>
                <td>$${sale.total_price.toFixed(2)}</td>
            </tr>
        `).join('');
    }
}

// Animate value changes
function animateValue(element, start, end) {
    const duration = 1000;
    const range = end - start;
    const increment = range / (duration / 16);
    let current = start;
    
    const animate = () => {
        current += increment;
        element.textContent = Math.round(current);
        
        if ((increment > 0 && current < end) || (increment < 0 && current > end)) {
            requestAnimationFrame(animate);
        } else {
            element.textContent = end;
        }
    };
    
    requestAnimationFrame(animate);
}

// Show notification
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `alert alert-${type} notification fade-in`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => notification.remove(), 500);
    }, 3000);
}

// Restock product
function restockProduct(productId) {
    const newStock = prompt('Enter new stock quantity:');
    if (newStock === null) return;
    
    fetch(`/api/products/${productId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            stock: parseInt(newStock)
        })
    })
    .then(response => {
        if (!response.ok) throw new Error('Failed to update stock');
        showNotification('Stock updated successfully', 'success');
        updateDashboardStats();
    })
    .catch(error => {
        console.error('Error:', error);
        showNotification('Failed to update stock', 'danger');
    });
}

// Add CSS classes for animations
const style = document.createElement('style');
style.textContent = `
    .fade-in {
        animation: fadeIn 0.5s ease-in;
    }
    
    .fade-out {
        animation: fadeOut 0.5s ease-out;
    }
    
    .notification {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 1000;
        min-width: 200px;
    }
    
    @keyframes fadeIn {
        from { opacity: 0; transform: translateY(-10px); }
        to { opacity: 1; transform: translateY(0); }
    }
    
    @keyframes fadeOut {
        from { opacity: 1; transform: translateY(0); }
        to { opacity: 0; transform: translateY(-10px); }
    }
    
    .table-hover {
        background-color: rgba(0, 123, 255, 0.1) !important;
        transition: background-color 0.3s ease;
    }
`;
document.head.appendChild(style);

// Handle Search with Debounce
function handleSearch(e) {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        const searchTerm = e.target.value.toLowerCase();
        filterProducts(searchTerm);
    }, 300);
}

// Handle Category Filter
function handleCategoryFilter(e) {
    const category = e.target.value;
    filterProducts(searchInput.value, category);
}

// Filter Products
function filterProducts(searchTerm = '', category = '') {
    const rows = productTableBody.getElementsByTagName('tr');
    
    Array.from(rows).forEach(row => {
        const productName = row.getAttribute('data-name').toLowerCase();
        const productCategory = row.getAttribute('data-category');
        
        const matchesSearch = productName.includes(searchTerm);
        const matchesCategory = !category || productCategory === category;
        
        if (matchesSearch && matchesCategory) {
            row.style.display = '';
            row.classList.add('fade-in');
        } else {
            row.style.display = 'none';
            row.classList.remove('fade-in');
        }
    });
}

// Load Products with Animation
async function loadProducts() {
    showLoading();
    try {
        const response = await fetch('/api/products');
        const products = await response.json();
        
        if (productTableBody) {
            productTableBody.innerHTML = '';
            products.forEach((product, index) => {
                const row = createProductRow(product);
                row.style.animationDelay = `${index * 0.1}s`;
                productTableBody.appendChild(row);
            });
        }
        
        updateDashboardStats(products);
    } catch (error) {
        showToast('Error loading products', 'error');
    } finally {
        hideLoading();
    }
}

// Create Product Row with Animation
function createProductRow(product) {
    const row = document.createElement('tr');
    row.setAttribute('data-name', product.name);
    row.setAttribute('data-category', product.category);
    row.classList.add('fade-in');
    
    row.innerHTML = `
        <td>${product.name}</td>
        <td>${product.category}</td>
        <td>$${product.price.toFixed(2)}</td>
        <td>
            <span class="stock-badge ${getStockClass(product.stock)}">
                ${product.stock}
            </span>
        </td>
        <td>
            <button class="btn btn-sm btn-primary" onclick="editProduct(${product.id})">
                <i class="fas fa-edit"></i>
            </button>
            <button class="btn btn-sm btn-danger" onclick="deleteProduct(${product.id})">
                <i class="fas fa-trash"></i>
            </button>
        </td>
    `;
    
    return row;
}

// Get Stock Class
function getStockClass(stock) {
    if (stock <= 5) return 'stock-low';
    if (stock <= 15) return 'stock-medium';
    return 'stock-high';
}

// Update Dashboard Stats
function updateDashboardStats(products) {
    const totalProducts = products.length;
    const lowStockItems = products.filter(p => p.stock <= 5).length;
    const totalValue = products.reduce((sum, p) => sum + (p.price * p.stock), 0);
    
    updateStatCard('totalProducts', totalProducts);
    updateStatCard('lowStockItems', lowStockItems);
    updateStatCard('totalValue', `$${totalValue.toFixed(2)}`);
}

// Update Stat Card with Animation
function updateStatCard(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.classList.add('fade-in');
        element.textContent = value;
    }
}

// Show Loading Spinner
function showLoading() {
    if (loadingSpinner) {
        loadingSpinner.style.display = 'block';
    }
}

// Hide Loading Spinner
function hideLoading() {
    if (loadingSpinner) {
        loadingSpinner.style.display = 'none';
    }
}

// Toast System
function setupToastSystem() {
    const toastContainer = document.createElement('div');
    toastContainer.id = 'toastContainer';
    document.body.appendChild(toastContainer);
}

// Show Toast Message
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type} fade-in`;
    toast.textContent = message;
    
    document.getElementById('toastContainer').appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Theme Toggle
function setupThemeToggle() {
    const themeToggle = document.createElement('button');
    themeToggle.className = 'theme-toggle';
    themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
    themeToggle.onclick = toggleTheme;
    
    document.querySelector('.navbar').appendChild(themeToggle);
}

// Toggle Theme
function toggleTheme() {
    document.body.classList.toggle('dark-theme');
    const icon = document.querySelector('.theme-toggle i');
    icon.classList.toggle('fa-moon');
    icon.classList.toggle('fa-sun');
}

// Edit Product
async function editProduct(id) {
    try {
        const response = await fetch(`/api/products/${id}`);
        const product = await response.json();
        
        // Populate and show edit modal
        document.getElementById('editProductId').value = product.id;
        document.getElementById('editProductName').value = product.name;
        document.getElementById('editProductPrice').value = product.price;
        document.getElementById('editProductStock').value = product.stock;
        document.getElementById('editProductCategory').value = product.category;
        
        new bootstrap.Modal(document.getElementById('editProductModal')).show();
    } catch (error) {
        showToast('Error loading product details', 'error');
    }
}

// Delete Product
async function deleteProduct(id) {
    if (confirm('Are you sure you want to delete this product?')) {
        try {
            const response = await fetch(`/api/products/${id}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                showToast('Product deleted successfully');
                loadProducts();
            } else {
                throw new Error('Failed to delete product');
            }
        } catch (error) {
            showToast('Error deleting product', 'error');
        }
    }
}

// Export Products
async function exportProducts() {
    try {
        const response = await fetch('/api/products/export');
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'products.csv';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
        showToast('Products exported successfully');
    } catch (error) {
        showToast('Error exporting products', 'error');
    }
}

// Import Products
async function importProducts(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        const response = await fetch('/api/products/import', {
            method: 'POST',
            body: formData
        });
        
        if (response.ok) {
            showToast('Products imported successfully');
            loadProducts();
        } else {
            throw new Error('Failed to import products');
        }
    } catch (error) {
        showToast('Error importing products', 'error');
    }
}

// Chat functionality
function toggleChat() {
    const chatContainer = document.getElementById('chatContainer');
    chatContainer.style.display = chatContainer.style.display === 'none' ? 'flex' : 'none';
}

function handleChatInput(event) {
    if (event.key === 'Enter') {
        sendMessage();
    }
}

function addMessage(content, isUser = false) {
    const messagesContainer = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user' : 'bot'}`;
    messageDiv.innerHTML = `<div class="message-content">${content}</div>`;
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

async function sendMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    
    if (!message) return;
    
    // Add user message
    addMessage(message, true);
    input.value = '';
    
    // Show typing indicator
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message bot typing';
    typingDiv.innerHTML = '<div class="message-content">Thinking</div>';
    document.getElementById('chatMessages').appendChild(typingDiv);
    
    try {
        // Send message to n8n endpoint
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ message })
        });
        
        const data = await response.json();
        
        // Remove typing indicator
        typingDiv.remove();
        
        // Add bot response
        addMessage(data.response);
        
    } catch (error) {
        // Remove typing indicator
        typingDiv.remove();
        
        // Show error message
        addMessage('Sorry, I encountered an error. Please try again later.');
        console.error('Chat error:', error);
    }
} 