import { json } from "@remix-run/node";
// import { PrismaClient } from "@prisma/client";

// const prisma = new PrismaClient();
import prisma from "../db.server";

export const loader = async ({ params }) => {
    try {
        const productId = params.productId;

        // Find product by ID or Shopify Product ID
        let product = await prisma.product.findUnique({
            where: { id: productId },
            include: {
                steps: {
                    include: {
                        options: {
            orderBy: {
                order: "asc",
            },
        },
                    },
                    orderBy: {
                        order: "asc",
                    },
                },
            },
        });

        // If not found by ID, try by Shopify Product ID
        if (!product) {
            product = await prisma.product.findUnique({
                where: { shopifyProductId: productId },
                include: {
                    steps: {
                        include: {
                            options: {
            orderBy: {
                order: "asc",
            },
        },
                        },
                        orderBy: {
                            order: "asc",
                        },
                    },
                },
            });
        }

        if (!product) {
            return json(
                { success: false, error: "Product configuration not found" },
                {
                    status: 404,
                    headers: {
                        "Access-Control-Allow-Origin": "*",
                    }
                }
            );
        }

        // Transform to frontend-friendly format (MOCK_CONFIG structure)
        const config = {
            product: {
                id: product.id,
                shopifyProductId: product.shopifyProductId,
                name: product.name,
                basePrice: product.basePrice,
                defaultVariantImage: product.defaultVariantImage,
            },
            steps: product.steps.map(step => {
                const stepData = {
                    key: step.key,
                    type: step.type.toLowerCase(), // "OPTIONS" → "options"
                    title: step.title,
                    subtitle: step.subtitle,
                    description: step.description,
                    image: step.image,
                };

                if (step.type === "OPTIONS" || step.type === "DROPDOWN") {
                    stepData.options = step.options.map(option => ({
                        value: option.value,
                        label: option.label,
                        description: option.description,
                        image: option.image,
                        price: option.price,
                        showSteps: option.showSteps ? JSON.parse(option.showSteps) : null,
                        order: option.order,
                        parentOptionIds: option.parentOptionIds || null,
                    }));
                }

                if (step.type === "MEASUREMENT") {
                    stepData.width = {
                        min: step.widthMin,
                        max: step.widthMax,
                    };
                    stepData.height = {
                        min: step.heightMin,
                        max: step.heightMax,
                    };
                }

                return stepData;
            }),
        };

        return json(
            { success: true, config },
            {
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Cache-Control": "public, max-age=300", // Cache for 5 minutes
                }
            }
        );
    } catch (error) {
        console.error("Public API Error:", error);
        return json(
            { success: false, error: error.message },
            {
                status: 500,
                headers: {
                    "Access-Control-Allow-Origin": "*",
                }
            }
        );
    }
};

// Handle CORS preflight
export const action = async () => {
    return json(
        {},
        {
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type",
            }
        }
    );
};