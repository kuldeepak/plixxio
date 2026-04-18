import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
// import { PrismaClient } from "@prisma/client";

// const prisma = new PrismaClient();
import prisma from "../db.server";

export const action = async ({ request }) => {
    const { admin, session } = await authenticate.public.appProxy(request);

    try {
        const body = await request.json();
        console.log("body", body);
        const {
            productId,
            selections,
            measurements,
            quantity,
            calculatedPrice,
            baseProductTitle
            
        } = body;

        if (!productId) {
            return json(
                { success: false, error: "Product ID is required" },
                { status: 400 }
            );
        }

        // Get product configuration
        let product = await prisma.product.findUnique({
            where: { id: productId },
            include: {
                steps: {
                    include: {
                        options: true,
                    },
                },
            },
        });

        if (!product) {
            product = await prisma.product.findUnique({
                where: { shopifyProductId: productId },
                include: {
                    steps: {
                        include: {
                            options: true,
                        },
                    },
                },
            });
        }

        if (!product) {
            return json(
                { success: false, error: "Product configuration not found" },
                { status: 404 }
            );
        }

        // ============================================
        // Build Product Title
        // ============================================
        let productTitle = baseProductTitle || product.name;

        // Add configuration details to title
        const titleParts = [productTitle];

        if (selections) {
            Object.entries(selections).forEach(([key, value]) => {
                const step = product.steps.find(s => s.key === key);
                if (step) {
                    const option = step.options.find(o => o.value === value);
                    if (option) {
                        titleParts.push(option.label);
                    }
                }
            });
        }

        if (measurements && measurements.breite && measurements.hoehe) {
            titleParts.push(`${measurements.breite}x${measurements.hoehe}mm`);
        }

        const finalTitle = titleParts.join(' - ');

        // ============================================
        // Build Product Options
        // ============================================
        const productOptions = [];

        // Add selections as options
        if (selections) {
            Object.entries(selections).forEach(([key, value]) => {
                const step = product.steps.find(s => s.key === key);
                if (step) {
                    const option = step.options.find(o => o.value === value);
                    if (option) {
                        productOptions.push({
                            name: step.title,
                            values: [{ name: option.label }]
                        });
                    }
                }
            });
        }

        // Add measurements as option
        if (measurements && measurements.breite && measurements.hoehe) {
            productOptions.push({
                name: "Maße",
                values: [{ name: `${measurements.breite} x ${measurements.hoehe} mm` }]
            });
        }

        // ============================================
        // Create Product in Shopify
        // ============================================
        const createProductMutation = `
      mutation productCreate($product: ProductCreateInput!) {
        productCreate(product: $product) {
          product {
            id
            title
            handle
            variants(first: 1) {
              edges {
                node {
                  id
                  price
                  inventoryQuantity
                }
              }
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

        const productCreateResponse = await admin.graphql(createProductMutation, {
            variables: {
                product: {
                    title: finalTitle,
                    productOptions: productOptions,
                    variants: [{
                        price: calculatedPrice.toString(),
                        inventoryPolicy: "CONTINUE", // Allow selling when out of stock
                        inventoryManagement: null, // Don't track inventory
                    }],
                    status: "ACTIVE",
                    productCategory: {
                        productTaxonomyNodeId: "gid://shopify/ProductTaxonomyNode/1" // Generic category
                    }
                }
            }
        });

        const productData = await productCreateResponse.json();

        console.log('Product Create Response:', JSON.stringify(productData, null, 2));

        if (productData.data?.productCreate?.userErrors?.length > 0) {
            const error = productData.data.productCreate.userErrors[0];
            return json(
                { success: false, error: `Shopify error: ${error.message}` },
                { status: 500 }
            );
        }

        if (!productData.data?.productCreate?.product) {
            return json(
                { success: false, error: "Failed to create product" },
                { status: 500 }
            );
        }

        const createdProduct = productData.data.productCreate.product;
        const variantId = createdProduct.variants.edges[0].node.id;

        // ============================================
        // Save Configuration to Database
        // ============================================
        const orderConfig = await prisma.orderConfiguration.create({
            data: {
                productId: product.id,
                orderId: null,
                selections: JSON.stringify(selections || {}),
                measurements: JSON.stringify(measurements || {}),
                quantity: quantity || 1,
                calculatedPrice: calculatedPrice || 0,
            },
        });

        // ============================================
        // Return data for frontend to add to cart
        // ============================================
        return json({
            success: true,
            shopifyProduct: {
                id: createdProduct.id,
                title: createdProduct.title,
                handle: createdProduct.handle,
                variantId: variantId,
            },
            configurationId: orderConfig.id,
            quantity: quantity || 1,
        });

    } catch (error) {
        console.error("Create Product Error:", error);
        return json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
};

// Handle CORS preflight
export const loader = async () => {
    return json(
        {},
        {
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type",
            }
        }
    );
};