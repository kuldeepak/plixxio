import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
// import { PrismaClient } from "@prisma/client";

// const prisma = new PrismaClient();
import prisma from "../db.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);

  const url = new URL(request.url);
  const action = url.searchParams.get("action");

  try {
    if (action === "getProducts") {
      const products = await prisma.product.findMany({
        include: {
          steps: {
            include: {
              options: true,
            },
            orderBy: {
              order: "asc",
            },
          },
          priceMatrices: true,
        },
      });

      return json({ success: true, products });
    }

    if (action === "getProduct") {
      const productId = url.searchParams.get("productId");

      const product = await prisma.product.findUnique({
        where: { id: productId },
        include: {
          steps: {
            include: {
              options: true,
            },
            orderBy: {
              order: "asc",
            },
          },
          priceMatrices: true,
        },
      });

      return json({ success: true, product });
    }

    return json({ success: true, data: null });
  } catch (error) {
    console.error("API Error:", error);
    return json({ success: false, error: error.message }, { status: 500 });
  }
};

export const action = async ({ request }) => {
 const { admin } = await authenticate.admin(request);

  const formData = await request.formData();
  const actionType = formData.get("action");

  console.log("API Action called:", actionType); // Debug log

  try {
    if (actionType === "createProduct") {
  const { admin } = await authenticate.admin(request);

  const shopifyProductId = formData.get("shopifyProductId");
  const name = formData.get("name");
  const basePrice = parseFloat(formData.get("basePrice") || 0);

  console.log("Creating product:", { shopifyProductId, name, basePrice });

  // 🟢 STEP 1 — Shopify se FIRST VARIANT IMAGE fetch karo
  let firstVariantImage = null;

  try {
    const response = await admin.graphql(
      `#graphql
      query getProduct($id: ID!) {
        product(id: $id) {
          variants(first: 1) {
            edges {
              node {
                image {
                  url
                }
              }
            }
          }
        }
      }`,
      {
        variables: { id: shopifyProductId },
      }
    );

    const shopifyData = await response.json();

    firstVariantImage =
      shopifyData?.data?.product?.variants?.edges[0]?.node?.image?.url || null;

    console.log("Variant image fetched:", firstVariantImage);
  } catch (err) {
    console.log("Image fetch failed, using null");
  }

  // 🟢 STEP 2 — DB me SAVE karo (IMPORTANT)
  const product = await prisma.product.create({
    data: {
      shopifyProductId,
      name,
      basePrice,
      defaultVariantImage: firstVariantImage, // ⭐ NEW FIELD
    },
  });

  console.log("Product created:", product);

  return json({ success: true, product });
}

    if (actionType === "createStep") {
      const productId = formData.get("productId");
      const key = formData.get("key");
      const type = formData.get("type");
      const title = formData.get("title");
      const subtitle = formData.get("subtitle") || "";
      const description = formData.get("description") || "";
      const image = formData.get("image") || "";
      const order = parseInt(formData.get("order"));

      const widthMin = formData.get("widthMin")
        ? parseInt(formData.get("widthMin"))
        : null;
      const widthMax = formData.get("widthMax")
        ? parseInt(formData.get("widthMax"))
        : null;
      const heightMin = formData.get("heightMin")
        ? parseInt(formData.get("heightMin"))
        : null;
      const heightMax = formData.get("heightMax")
        ? parseInt(formData.get("heightMax"))
        : null;

      const step = await prisma.configurationStep.create({
        data: {
          productId,
          key,
          type,
          title,
          subtitle,
          description,
          image,
          order,
          widthMin,
          widthMax,
          heightMin,
          heightMax,
        },
      });

      return json({ success: true, step });
    }

    if (actionType === "createOption") {
      const stepId = formData.get("stepId");
      const value = formData.get("value");
      const label = formData.get("label");
      const description = formData.get("description") || "";
      const image = formData.get("image") || "";
      const price = parseFloat(formData.get("price") || 0);
      const showSteps = formData.get("showSteps") || null;

      const option = await prisma.stepOption.create({
        data: {
          stepId,
          value,
          label,
          description,
          image,
          price,
          showSteps,
        },
      });

      return json({ success: true, option });
    }

    if (actionType === "createPriceMatrix") {
      const productId = formData.get("productId");
      const widthMin = parseInt(formData.get("widthMin"));
      const widthMax = parseInt(formData.get("widthMax"));
      const heightMin = parseInt(formData.get("heightMin"));
      const heightMax = parseInt(formData.get("heightMax"));
      const price = parseFloat(formData.get("price"));

      const priceMatrix = await prisma.priceMatrix.create({
        data: {
          productId,
          widthMin,
          widthMax,
          heightMin,
          heightMax,
          price,
        },
      });

      return json({ success: true, priceMatrix });
    }

    return json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("API Error:", error);
    return json({ success: false, error: error.message }, { status: 500 });
  }
};
