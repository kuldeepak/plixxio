import { useState, useEffect } from "react";
import { useFetcher, useNavigate, useRevalidator } from "react-router";
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
  await authenticate.admin(request);

  const formData = await request.formData();
  const actionType = formData.get("action");

  try {
    // ============================================
    // DELETE PRODUCT
    // ============================================
    if (actionType === "deleteProduct") {
      const productId = formData.get("productId");

      // Cascade delete will handle steps, options, price matrices
      await prisma.product.delete({
        where: { id: productId },
      });

      return json({ success: true });
    }


    // ============================================
    // DUPLICATE PRODUCT
    // ============================================
    if (actionType === "duplicateProduct") {
      const productId = formData.get("productId");

      const originalProduct = await prisma.product.findUnique({
        where: { id: productId },
        include: {
          steps: {
            include: {
              options: true,
            },
          },
          priceMatrices: true,
        },
      });

      if (!originalProduct) {
        return json({ success: false, error: "Product not found" }, { status: 404 });
      }

      const newProduct = await prisma.product.create({
        data: {
          name: `${originalProduct.name} (Copy)`,
          shopifyProductId: `${originalProduct.shopifyProductId}-copy-${Date.now()}`, // must be unique
          basePrice: originalProduct.basePrice,
          sku: originalProduct.sku,

          steps: {
            create: originalProduct.steps.map((step) => ({
              key: step.key, // safe because new product
              type: step.type,
              title: step.title,
              subtitle: step.subtitle,
              description: step.description,
              image: step.image,
              order: step.order,
              widthMin: step.widthMin,
              widthMax: step.widthMax,
              heightMin: step.heightMin,
              heightMax: step.heightMax,
              measurementMode: step.measurementMode,
flugelMin: step.flugelMin,
flugelMax: step.flugelMax,

              options: {
                create: step.options.map((option) => ({
                  value: option.value,
                  label: option.label,
                  description: option.description,
                  image: option.image,
                  price: option.price,
                  showSteps: option.showSteps,
                })),
              },
            })),
          },

          priceMatrices: {
            create: originalProduct.priceMatrices.map((matrix) => ({
              widthMin: matrix.widthMin,
              widthMax: matrix.widthMax,
              heightMin: matrix.heightMin,
              heightMax: matrix.heightMax,
              price: matrix.price,
            })),
          },
        },
      });

      return json({ success: true, duplicated: true, product: newProduct });
    }


    return json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Action Error:", error);
    return json({ success: false, error: error.message }, { status: 500 });
  }
};

export default function Configurator() {
  const fetcher = useFetcher();
  const navigate = useNavigate();
  const shopify = useAppBridge();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const revalidator = useRevalidator();
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    fetch("/api/configurator?action=getProducts")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setProducts(data.products);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [refreshKey]);

  useEffect(() => {
    if (fetcher.data?.success) {
      if (fetcher.data.duplicated) {
        shopify.toast.show("Produkt erfolgreich dupliziert");
      } else {
        shopify.toast.show("Produkt erfolgreich gelöscht");
      }

      setRefreshKey(prev => prev + 1);
    } else if (fetcher.data?.error) {
      shopify.toast.show(`Error: ${fetcher.data.error}`);
    }
  }, [fetcher.data, shopify]);

  const handleCreateProduct = () => {
    navigate("/app/configuratory");
  };

  const handleDeleteProduct = (productId) => {
    if (
      confirm(
        "Sind Sie sicher, dass Sie dieses Produkt löschen möchten? Alle Schritte, Optionen und Preise werden gelöscht!",
      )
    ) {
      const submitData = new FormData();
      submitData.append("action", "deleteProduct");
      submitData.append("productId", productId);
      fetcher.submit(submitData, { method: "POST" });
    }
  };

  const handleDuplicateProduct = (productId) => {
    const submitData = new FormData();
    submitData.append("action", "duplicateProduct");
    submitData.append("productId", productId);

    fetcher.submit(submitData, { method: "POST" });
  };


  return (
    <s-page heading="Produkt-Konfigurator">
      <s-button slot="primary-action" onClick={handleCreateProduct}>
        Neues Produkt hinzufügen
      </s-button>

      <s-section heading="Konfigurierte Produkte">
        <s-paragraph>
          Produktkonfigurationen, Schritte, Optionen und Preismatrizen verwalten.
        </s-paragraph>

        {loading ? (
          <s-paragraph>Produkte laden...</s-paragraph>
        ) : products.length === 0 ? (
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack direction="block" gap="base">
              <s-heading>Noch keine Produkte konfiguriert.</s-heading>
              <s-paragraph>
                Klicken Sie auf "Neues Produkt hinzufügen", um Ihre erste Konfiguration zu erstellen.
              </s-paragraph>
            </s-stack>
          </s-box>
        ) : (
          <s-stack direction="block" gap="base">
            {products.map((product) => (
              <s-box
                key={product.id}
                padding="base"
                borderWidth="base"
                borderRadius="base"
              >
                <s-stack direction="block" gap="tight">
                  <s-stack
                    direction="inline"
                    gap="base"
                    style={{
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <s-heading>{product.name}</s-heading>
                    <s-button
                      variant="secondary"
                      onClick={() => handleDuplicateProduct(product.id)}
                    >
                      Produkt duplizieren
                    </s-button>
                    <s-button
                      variant="tertiary"
                      tone="critical"
                      onClick={() => handleDeleteProduct(product.id)}
                    >
                      Produkt löschen
                    </s-button>
                  </s-stack>

                  <s-paragraph>
                    <s-text>
                      <strong>Shopify ID:</strong> {product.shopifyProductId}
                    </s-text>
                  </s-paragraph>
                  <s-paragraph>
                    <s-text>
                      <strong>Schritte:</strong> {product.steps?.length || 0}
                    </s-text>
                  </s-paragraph>
                  <s-paragraph>
                    <s-text>
                      <strong>Grundpreis:</strong>{" "}
                      {product.basePrice.toFixed(2)} €
                    </s-text>
                  </s-paragraph>
                  <s-stack direction="inline" gap="base">
                    <s-button
                      onClick={() =>
                        navigate(`/app/configuratoryy/${product.id}`)
                      }
                    >
                      Schritte konfigurieren
                    </s-button>
                    <s-button
                      variant="secondary"
                      onClick={() =>
                        navigate(`/app/configuratoryyy/pricing/${product.id}`)
                      }
                    >
                      Preise verwalten
                    </s-button>
                    <s-button
                      variant="tertiary"
                      onClick={() =>
                        navigate(`/app/configuratore/edit/${product.id}`)
                      }
                    >
                      Produkt bearbeiten
                    </s-button>
                  </s-stack>
                </s-stack>
              </s-box>
            ))}
          </s-stack>
        )}
      </s-section>

      <s-section slot="aside" heading="Kurzanleitung">
        <s-unordered-list>
          <s-list-item>Produktkonfiguration erstellen</s-list-item>
          <s-list-item>Schritte hinzufügen (Optionen oder Maße)</s-list-item>
          <s-list-item>Schrittoptionen mit Preisen konfigurieren</s-list-item>
          <s-list-item>Preismatrix für Maße einrichten</s-list-item>
        </s-unordered-list>
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};