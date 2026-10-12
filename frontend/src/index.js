import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import "@/axiosErrorInterceptor";
import App from "@/App";
import { CartProvider } from "@/CartContext";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <CartProvider>
      <App />
    </CartProvider>
  </React.StrictMode>,
);
