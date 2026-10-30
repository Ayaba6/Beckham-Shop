import React, { createContext, useContext, useState } from 'react';

const CartContext = createContext();

export function CartProvider({ children }) {
  const [cartItems, setCartItems] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  // Ajouter un article au panier
  const addToCart = (product, imeiItem = null) => {
    setCartItems((prevItems) => {
      // Si c'est un téléphone avec IMEI, c'est un article unique
      if (imeiItem) {
        const exists = prevItems.find((item) => item.imeiId === imeiItem.id);
        if (exists) return prevItems; // Déjà dans le panier
        return [
          ...prevItems,
          {
            id: `${product.id}-${imeiItem.id}`,
            productId: product.id,
            name: `${product.name} (${product.brand || ''})`,
            model: product.model,
            unitPrice: Number(product.selling_price),
            quantity: 1,
            imeiId: imeiItem.id,
            imeiNumber: imeiItem.imei_number,
            isSerialized: true,
          },
        ];
      }

      // Si c'est un accessoire (quantité globale)
      const existingIndex = prevItems.findIndex(
        (item) => item.productId === product.id && !item.imeiId
      );

      if (existingIndex > -1) {
        const updated = [...prevItems];
        updated[existingIndex].quantity += 1;
        return updated;
      }

      return [
        ...prevItems,
        {
          id: product.id,
          productId: product.id,
          name: product.name,
          model: product.model,
          unitPrice: Number(product.selling_price),
          quantity: 1,
          imeiId: null,
          imeiNumber: null,
          isSerialized: false,
        },
      ];
    });
  };

  // Modifier la quantité d'un article
  const updateQuantity = (id, delta) => {
    setCartItems((prevItems) =>
      prevItems
        .map((item) => {
          if (item.id === id) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean)
    );
  };

  // Supprimer un article du panier
  const removeFromCart = (id) => {
    setCartItems((prev) => prev.filter((item) => item.id !== id));
  };

  // Vider complètement le panier
  const clearCart = () => {
    setCartItems([]);
    setSelectedCustomer(null);
  };

  // Calcul du montant total
  const totalAmount = cartItems.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0
  );

  return (
    <CartContext.Provider
      value={{
        cartItems,
        selectedCustomer,
        setSelectedCustomer,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
        totalAmount,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}