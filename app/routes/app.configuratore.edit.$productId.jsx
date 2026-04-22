import { useState, useEffect } from "react";
import {
  useFetcher,
  useNavigate,
  useParams,
  useLoaderData,
} from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { json } from "@remix-run/node";
// import { PrismaClient } from "@prisma/client";

// const prisma = new PrismaClient();
import prisma from "../db.server";

export const loader = async ({ request, params }) => {
  await authenticate.admin(request);

  const productId = params.productId;

  const product = await prisma.product.findUnique({
    where: { id: productId },
  });

  return json({ product });
};

export const action = async ({ request, params }) => {
  await authenticate.admin(request);

  const formData = await request.formData();
  const productId = params.productId;

  const shopifyProductId = formData.get("shopifyProductId");
  const name = formData.get("name");
  const basePrice = parseFloat(formData.get("basePrice") || 0);
  const sku = formData.get("sku");

  try {
    const product = await prisma.product.update({
      where: { id: productId },
      data: {
        shopifyProductId,
        name,
        basePrice,
        sku,
      },
    });

    return json({ success: true, product });
  } catch (error) {
    console.error("Update Product Error:", error);
    return json({ success: false, error: error.message }, { status: 500 });
  }
};

export default function EditProduct() {
  const { product } = useLoaderData();
  const fetcher = useFetcher();
  const navigate = useNavigate();
  const shopify = useAppBridge();

  const [formData, setFormData] = useState({
    shopifyProductId: product?.shopifyProductId || "",
    name: product?.name || "",
    basePrice: product?.basePrice?.toString() || "0",
    sku: product?.sku || "",
  });

  const isLoading = ["loading", "submitting"].includes(fetcher.state);

  useEffect(() => {
    if (fetcher.data?.success && fetcher.data?.product) {
      shopify.toast.show("Product updated successfully");
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
    submitData.append("sku", formData.sku);
    fetcher.submit(submitData, { method: "POST" });
  };

  if (!product) {
    return (
      <s-page heading="Produkt nicht gefunden">
        <s-section>
          <s-paragraph>Produkt nicht gefunden.</s-paragraph>
          <s-button onClick={() => navigate("/app/configurator")}>
            Zurück zur Liste
          </s-button>
        </s-section>
      </s-page>
    );
  }

  return (
    <s-page heading="Produkt bearbeiten">
      <s-button
        slot="secondary-action"
        onClick={() => navigate("/app/configurator")}
      >
        Zurück zur Liste
      </s-button>

      <s-section heading="Produktdetails">
        <s-stack direction="block" gap="base">
          <s-stack direction="block" gap="tight">
            <s-text variant="headingSm">Shopify Produkt ID</s-text>
            <input
              type="text"
              value={formData.shopifyProductId}
              onChange={(e) =>
                setFormData({ ...formData, shopifyProductId: e.target.value })
              }
              placeholder="gid://shopify/Product/123456789"
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid #c9cccf",
                borderRadius: "4px",
                fontSize: "14px",
              }}
            />
            <s-text variant="bodySm" tone="subdued">
              Die Shopify Produkt GID (z.B., gid://shopify/Product/123456789)
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
                width: "100%",
                padding: "8px 12px",
                border: "1px solid #c9cccf",
                borderRadius: "4px",
                fontSize: "14px",
              }}
            />
            <s-text variant="bodySm" tone="subdued">
              Produktname für diese Konfiguration
            </s-text>
          </s-stack>

          <s-stack direction="block" gap="tight">
            <s-text variant="headingSm">SKU</s-text>
            <input
              type="text"
              value={formData.sku}
              onChange={(e) =>
                setFormData({ ...formData, sku: e.target.value })
              }
              placeholder="ABC-123"
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid #c9cccf",
                borderRadius: "4px",
                fontSize: "14px",
              }}
            />
            <s-text variant="bodySm" tone="subdued">
              Interne Artikelnummer (SKU)
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
                width: "100%",
                padding: "8px 12px",
                border: "1px solid #c9cccf",
                borderRadius: "4px",
                fontSize: "14px",
              }}
            />
            <s-text variant="bodySm" tone="subdued">
              Grundpreis von Shopify (normalerweise 0 wenn dynamische Preise)
            </s-text>
          </s-stack>

          <s-stack direction="inline" gap="base">
            <s-button
              onClick={handleSubmit}
              {...(isLoading ? { loading: true } : {})}
              disabled={!formData.shopifyProductId || !formData.name}
            >
              Produkt aktualisieren
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
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};