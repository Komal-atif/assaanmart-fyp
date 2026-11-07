export interface Product {
  id: string;
  name: string;
  category: string;
  subcategory: string;
  size: string;
  price: number | null;
  stock: number | null;
  icon: string;
  image: string;
  search: string;
}

export interface Category {
  name: string;
  icon: string;
  subcategories: string[];
}

export interface CartItem extends Product {
  quantity: number;
}

export interface User {
  name: string;
  email: string;
  phone?: string;
  address?: string;
}

export interface Order {
  id: string;
  date: string;
  items: CartItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  customerName: string;
  phone: string;
  address: string;
  city: string;
  paymentMethod: string;
  status: 'Confirmed' | 'Packing' | 'Out for Delivery' | 'Delivered';
}
