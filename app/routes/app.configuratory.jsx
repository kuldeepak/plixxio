import { useState, useEffect } from "react";
import { useFetcher, useNavigate } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { json } from "@remix-run/node";
// import { PrismaClient } from "@prisma/client";

// const prisma = new PrismaClient();
import prisma from "../db.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return null;
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const shopifyProductId = formData.get("shopifyProductId");
  const name = formData.get("name");
  const basePrice = parseFloat(formData.get("basePrice") || 0);

  try {
    let rawInput = String(shopifyProductId || "").trim();
    
    // 1. Numeric ID nikalna (Clean ID for DB)
    // Agar input "gid://shopify/Product/12345" hai toh sirf "12345" lega
    const numericId = rawInput.replace(/[^0-9]/g, ""); 

    // 2. GID banana (Only for Shopify GraphQL Query)
    const graphqlId = `gid://shopify/Product/${numericId}`;

    if (!numericId) throw new Error("Invalid Shopify Product ID");

    // GraphQL Query
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

    const response = await admin.graphql(query, { variables: { id: graphqlId } });
    const result = await response.json();

    if (result?.errors) throw new Error(result.errors[0].message);

    const productData = result?.data?.product;
    if (!productData) throw new Error("Product not found in Shopify.");

    const firstVariant = productData.variants?.edges?.[0]?.node;
    const variantImageUrl = firstVariant?.image?.url || productData.featuredImage?.url || "";

    // 3. Save in Prisma (Using numericId)
    const product = await prisma.product.create({
      data: {
        shopifyProductId: numericId, // <-- Ab yahan sirf numbers save honge
        name: name,
        basePrice: basePrice,
        defaultVariantImage: variantImageUrl,
      },
    });

    return json({ success: true, product });
  } catch (error) {
    console.error("❌ Action Error:", error);
    return json({ success: false, error: error.message }, { status: 500 });
  }
};

export default function NewProduct() {
  const fetcher = useFetcher();
  const navigate = useNavigate();
  const shopify = useAppBridge();

  const [formData, setFormData] = useState({
    shopifyProductId: "",
    name: "",
    basePrice: "0",
  });

  const isLoading = ["loading", "submitting"].includes(fetcher.state);

  useEffect(() => {
    if (fetcher.data?.success && fetcher.data?.product) {
      shopify.toast.show("Produkt erfolgreich erstellt.");
      // Redirect to configurator list
      navigate("/app/configurator");
    } else if (fetcher.data?.error) {
      shopify.toast.show(`Error: ${fetcher.data.error}`);
    }
  }, [fetcher.data, shopify, navigate]);

  const handleSubmit = () => {
    const submitData = new FormData();
    submitData.append("shopifyProductId", formData.shopifyProductId);
    submitData.append("name", formData.name);
    submitData.append("basePrice", formData.basePrice);

    fetcher.submit(submitData, { method: "POST" });
  };

  return (
    <s-page heading="Neue Produktkonfiguration erstellen">
      <s-button
        slot="secondary-action"
        onClick={() => navigate("/app/configurator")}
      >
        Zurück zur Liste
      </s-button>

      <s-section heading="Product Details">
        <s-stack direction="block" gap="base">
          <s-stack direction="block" gap="tight">
            <s-text variant="headingSm">Shopify Product ID</s-text>
            <input
              type="text"
              value={formData.shopifyProductId}
              onChange={(e) =>
                setFormData({ ...formData, shopifyProductId: e.target.value })
              }
              placeholder="gid://shopify/Product/123456789"
              style={{
                width: "95%",
                padding: "8px 12px",
                border: "1px solid #c9cccf",
                borderRadius: "4px",
                fontSize: "14px",
              }}
            />
            <s-text variant="bodySm" tone="subdued">
              Die Shopify-Produkt-GID (e.g., 123456789)
            </s-text>
          </s-stack>

          <s-stack direction="block" gap="tight">
            <s-text variant="headingSm">Produktname</s-text>
            <input
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="Insektenschutz Fenster"
              style={{
                width: "95%",
                padding: "8px 12px",
                border: "1px solid #c9cccf",
                borderRadius: "4px",
                fontSize: "14px",
              }}
            />
            <s-text variant="bodySm" tone="subdued">
              Anzeigename für diese Konfiguration
            </s-text>
          </s-stack>

          <s-stack direction="block" gap="tight">
            <s-text variant="headingSm">Grundpreis (€)</s-text>
            <input
              type="number"
              step="0.01"
              value={formData.basePrice}
              onChange={(e) =>
                setFormData({ ...formData, basePrice: e.target.value })
              }
              placeholder="0.00"
              style={{
                width: "95%",
                padding: "8px 12px",
                border: "1px solid #c9cccf",
                borderRadius: "4px",
                fontSize: "14px",
              }}
            />
            <s-text variant="bodySm" tone="subdued">
              Grundpreis aus Shopify (in der Regel 0 bei dynamischer Preisgestaltung)
            </s-text>
          </s-stack>

          <s-stack direction="inline" gap="base">
            <s-button
              onClick={handleSubmit}
              {...(isLoading ? { loading: true } : {})}
              disabled={!formData.shopifyProductId || !formData.name}
            >
              Produkt erstellen
            </s-button>
            <s-button
              variant="tertiary"
              onClick={() => navigate("/app/configurator")}
            >
              Abbrechen
            </s-button>
          </s-stack>
        </s-stack>
      </s-section>

      <s-section slot="aside" heading="Nächste Schritte">
        <s-paragraph>Nach dem Erstellen des Produkts können Sie:</s-paragraph>
        <s-unordered-list>
          <s-list-item>Konfigurationsschritte hinzufügen</s-list-item>
          <s-list-item>Schrittoptionen mit Preisen definieren</s-list-item>
          <s-list-item>Messbereiche festlegen</s-list-item>
          <s-list-item>Preismatrix konfigurieren</s-list-item>
        </s-unordered-list>
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
