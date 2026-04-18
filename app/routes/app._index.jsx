import { useEffect } from "react";
import { useFetcher } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);

  return null;
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  const DEMO_IMAGE =
    "https://plixxo-de.myshopify.com/cdn/shop/files/1_Plissee_quarzgrau_Wohnzimmer-md.webp?v=1770817456&width=800"; // 👉 koi bhi public image

  /* -----------------------------------
  1️⃣ CREATE PRODUCT
  ----------------------------------- */
  const productRes = await admin.graphql(
    `#graphql
    mutation populateProduct($product: ProductCreateInput!) {
      productCreate(product: $product) {
        product {
          id
          title
          handle
          variants(first: 1) {
            edges {
              node { id }
            }
          }
        }
      }
    }`,
    {
      variables: {
        product: { title: "Configurator Product" },
      },
    }
  );

  const productJson = await productRes.json();
  const product = productJson.data.productCreate.product;
  const variantId = product.variants.edges[0].node.id;

  /* -----------------------------------
  2️⃣ UPLOAD PRODUCT IMAGE (MEDIA)
  ----------------------------------- */
  const mediaRes = await admin.graphql(
    `#graphql
    mutation addImage($productId: ID!, $media: [CreateMediaInput!]!) {
      productCreateMedia(productId: $productId, media: $media) {
        media { id status }
        mediaUserErrors { message }
      }
    }`,
    {
      variables: {
        productId: product.id,
        media: [
          {
            originalSource: DEMO_IMAGE,
            mediaContentType: "IMAGE",
          },
        ],
      },
    }
  );

  const mediaJson = await mediaRes.json();
  const imageId = mediaJson.data.productCreateMedia.media[0].id;

  /* -----------------------------------
  3️⃣ WAIT (Shopify needs few ms)
  ----------------------------------- */
  await new Promise(r => setTimeout(r, 2000));

  /* -----------------------------------
  4️⃣ UPDATE VARIANT → ADD IMAGE + PRICE
  ----------------------------------- */
  const variantRes = await admin.graphql(
    `#graphql
    mutation updateVariant($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) {
        productVariants {
          id
          price
          media {
            preview { image { url } }
          }
        }
      }
    }`,
    {
      variables: {
        productId: product.id,
        variants: [
          {
            id: variantId,
            price: "100.00",
            mediaId: imageId   // ⭐ VARIANT IMAGE SET
          },
        ],
      },
    }
  );

  const variantJson = await variantRes.json();

  return {
    product,
    variant: variantJson.data.productVariantsBulkUpdate.productVariants,
  };
};

export default function Index() {
  const fetcher = useFetcher();
  const shopify = useAppBridge();
  const isLoading =
    ["loading", "submitting"].includes(fetcher.state) &&
    fetcher.formMethod === "POST";

  useEffect(() => {
    if (fetcher.data?.product?.id) {
      shopify.toast.show("Product created");
    }
  }, [fetcher.data?.product?.id, shopify]);
  const generateProduct = () => fetcher.submit({}, { method: "POST" });

  return (
    <s-page heading="Vorlage für Konfigurator-App">
      <s-section heading="Produktkonfigurator bereit 🎉">
        <s-paragraph>
          Erstellen Sie konfigurierbare Produkte mit individuellen Größen, Optionen und dynamischer Preisgestaltung – alles direkt in Ihrem Shopify-Adminbereich verwaltet.
        </s-paragraph>

        <s-paragraph>
          Die Preise aktualisieren sich in Echtzeit anhand messungsbasierter Regeln und Preismatrizen und gewährleisten so maximale Genauigkeit von der Konfiguration bis zum Checkout.
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
