import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import AppRoutes from './routes/AppRoutes';
import { CartProvider } from './context/CartContext';

function App() {
  return (
    <BrowserRouter>
      <CartProvider>
        <div className="min-h-screen bg-gray-100 text-gray-900 font-sans antialiased">
          <AppRoutes />
        </div>
      </CartProvider>
    </BrowserRouter>
  );
}

export default App;