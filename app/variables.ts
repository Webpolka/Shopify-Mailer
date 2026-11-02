/**
 * Standard variables available in every Flow webhook payload.
 */

export interface VariableGroup {
  group: string;
  items: VariableItem[];
}

export interface VariableItem {
  name: string;
  description: string;
}

export const FLOW_VARIABLES: VariableGroup[] = [
  {
    group: "Customer",
    items: [
      { name: "customerEmail", description: "Customer's email address" },
      { name: "customerName", description: "Customer's first name" },
      { name: "customerId", description: "Shopify customer ID" },
    ],
  },
  {
    group: "Product",
    items: [
      { name: "productTitle", description: "Product title" },
      { name: "productUrl", description: "Full URL to product page" },
      { name: "productImage", description: "Product image URL" },
      { name: "productPrice", description: "Variant price" },
      { name: "productHandle", description: "Product handle (URL slug)" },
    ],
  },
  {
    group: "Shop",
    items: [
      { name: "shopName", description: "Your Shopify store name" },
      { name: "shopUrl", description: "Your Shopify store URL" },
    ],
  },
];