import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const action = async ({ request }) => {
  try {
    // 🔐 Validate webhook + get Admin API client (offline token)
    const { payload, topic, shop, admin } =
      await authenticate.webhook(request);

    console.log("📩 Webhook received:", topic, "for shop:", shop);

    // We only care about product updates
    if (topic !== "PRODUCTS_UPDATE") {
      return new Response("Ignored", { status: 200 });
    }

    const productId = payload.id;
    console.log("🛍 Shopify product changed → ID:", productId);

    const graphqlId = `gid://shopify/Product/${productId}`;

    // 🧠 Fetch product image from Shopify Admin API
    const query = `
      query getProductVariants($id: ID!) {
        product(id: $id) {
          variants(first: 1) {
            edges {
              node {
                image { url }
              }
            }
          }
          featuredImage { url }
        }
      }
    `;

    const response = await admin.graphql(query, {
      variables: { id: graphqlId },
    });

    const result = await response.json();

    console.log(
      "🔍 GraphQL response:",
      JSON.stringify(result, null, 2)
    );

    const firstVariant =
      result?.data?.product?.variants?.edges?.[0]?.node;

    const imageUrl =
      firstVariant?.image?.url ||
      result?.data?.product?.featuredImage?.url ||
      "";

    // 💾 Update your DB
    await prisma.product.updateMany({
      where: { shopifyProductId: String(productId) },
      data: { defaultVariantImage: imageUrl },
    });

    console.log("✅ DB synced. Updated image for product:", productId);

    // Shopify requires a fast 200 response
    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("❌ Webhook error:", error);
    return new Response("Webhook handler failed", { status: 500 });
  }
};