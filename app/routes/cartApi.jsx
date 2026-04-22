import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
// import { PrismaClient } from "@prisma/client";

// const prisma = new PrismaClient();
import prisma from "../db.server";

export const loader = async ({ request }) => {
  try {
    const { admin } = await authenticate.public.appProxy(request);

    if (!admin) {
      return json(
        { success: false, error: "App not installed for this shop" },
        { status: 403 }
      );
    }

    // Get query params for testing
    const url = new URL(request.url);
    const testMode = url.searchParams.get('test');

    if (testMode) {
      // Test product creation
      const testProduct = await createTestProduct(admin);
      return json(testProduct);
    }

    return json({ message: "Use POST method to create configured product" });
  } catch (error) {
    console.error("Loader Error:", error);
    return json({ success: false, error: error.message }, { status: 500 });
  }
};

export const action = async ({ request }) => {
  try {
    const { admin } = await authenticate.public.appProxy(request);

    if (!admin) {
      return json(
        { success: false, error: "App not installed for this shop" },
        { status: 403 }
      );
    }

    const body = await request.json();
    // console.log('Request body:', body);

    const {
      productId,
      selections,
      measurements,
      quantity,
      calculatedPrice,
      baseProductTitle,
      productImage, 
    } = body;

    if (!productId) {
      return json(
        { success: false, error: "Product ID is required" },
        { status: 400 }
      );
    }

    // ============================================
    // Get Product Configuration from Database
    // ============================================
    let product = await prisma.product.findFirst({
      where: {
        OR: [
          { id: productId },
          { shopifyProductId: productId }
        ]
      },
      include: {
        steps: {
          include: {
            options: true,
          },
          orderBy: {
            order: "asc",
          },
        },
      },
    });

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

    // const finalTitle = titleParts.join(' - ');

    const finalTitle = productTitle;

    // ============================================
    // Build Product Description (HTML)
    // ============================================
    let descriptionHTML = `<h3>Konfiguration Details</h3><ul>`;

    if (selections) {
      Object.entries(selections).forEach(([key, value]) => {
        const step = product.steps.find(s => s.key === key);
        if (step) {
          const option = step.options.find(o => o.value === value);
          if (option) {
            descriptionHTML += `<li><strong>${step.title}:</strong> ${option.label}`;
            if (option.description) {
              descriptionHTML += ` - ${option.description}`;
            }
            if (option.sku) {                                    // ADD THIS
              descriptionHTML += ` (SKU: ${option.sku})`;       // ADD THIS
            }
            descriptionHTML += `</li>`;
          }
        }
      });
    }

    if (measurements) {
      if (measurements.breite) {
        descriptionHTML += `<li><strong>Breite:</strong> ${measurements.breite} mm</li>`;
      }
      if (measurements.hoehe) {
        descriptionHTML += `<li><strong>Höhe:</strong> ${measurements.hoehe} mm</li>`;
      }
    }

    descriptionHTML += `</ul>`;
    descriptionHTML += `<p><strong>Berechneter Preis:</strong> ${calculatedPrice.toFixed(2)}</p>`;
    if (product.sku) { descriptionHTML += `<p><strong>SKU:</strong> ${product.sku}</p>`; }
    descriptionHTML += `<p><em>Dieses Produkt wurde automatisch basierend auf Ihrer Konfiguration erstellt.</em></p>`;

    // ============================================
    // Determine Product Image
    // ============================================
    const imageUrl = productImage ||
      "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_large.png";

    console.log('Creating product with title:', finalTitle);
    console.log('Image URL:', imageUrl);

    // ============================================
    // 1️⃣ CREATE PRODUCT WITH IMAGE
    // ============================================
    const createProductMutation = `
      mutation {
        productCreate(
          input: {
            title: "${finalTitle.replace(/"/g, '\\"')}",
            descriptionHtml: """${descriptionHTML}""",
            status: ACTIVE
          },
          media: [{
            originalSource: "${imageUrl}",
            mediaContentType: IMAGE,
            alt: "${finalTitle.replace(/"/g, '\\"')}"
          }]
        ) {
          product {
            id
            title
            handle
            variants(first: 1) {
              edges {
                node {
                  id
                  inventoryItem {
                    id
                  }
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

    const createRes = await admin.graphql(createProductMutation);
    const createData = await createRes.json();

    //console.log('Product Create Response:', JSON.stringify(createData, null, 2));

    const errors = createData.data?.productCreate?.userErrors || [];
    if (errors.length > 0) {
      throw new Error(errors.map(e => e.message).join(", "));
    }

    const createdProduct = createData.data.productCreate.product;
    const variant = createdProduct.variants.edges[0].node;

    console.log('Product created:', createdProduct.id);

    // ============================================
    // 2️⃣ ENABLE INVENTORY TRACKING
    // ============================================
    await admin.graphql(`
      mutation {
        inventoryItemUpdate(
          id: "${variant.inventoryItem.id}",
          input: { tracked: true , sku : "${product.sku ? product.sku : ''}", }
        ) {
          userErrors { message }
        }
      }
    `);

    // ============================================
    // 3️⃣ SET PRICE + CONTINUE SELLING
    // ============================================
    const updatePriceRes = await admin.graphql(`
      mutation productVariantsBulkUpdate(
        $productId: ID!,
        $variants: [ProductVariantsBulkInput!]!
      ) {
        productVariantsBulkUpdate(
          productId: $productId,
          variants: $variants
        ) {
          userErrors { message }
        }
      }
    `, {
      variables: {
        productId: createdProduct.id,
        variants: [
          {
            id: variant.id,
            price: calculatedPrice.toString(),
            inventoryPolicy: "CONTINUE",
          },
        ],
      },
    });

    const updatePriceData = await updatePriceRes.json();
    //console.log('Price update response:', updatePriceData);

    // ============================================
    // 4️⃣ PUBLISH TO ONLINE STORE
    // ============================================
    const pubRes = await admin.graphql(`
      query {
        publications(first: 5) {
          edges {
            node { id name }
          }
        }
      }
    `);

    const pubData = await pubRes.json();
    const onlineStore = pubData.data.publications.edges.find(
      (p) => p.node.name === "Online Store"
    )?.node;

    if (onlineStore) {
      await admin.graphql(`
        mutation publishablePublish($id: ID!, $input: [PublicationInput!]!) {
          publishablePublish(id: $id, input: $input) {
            userErrors { message }
          }
        }
      `, {
        variables: {
          id: createdProduct.id,
          input: [{ publicationId: onlineStore.id }],
        },
      });
      console.log('Product published to Online Store');
    } else {
      console.warn('Online Store channel not found');
    }


    // ============================================
    // 2️⃣.5 SET INVENTORY QUANTITY
    // ============================================

    // Get first available location
    const locationRes = await admin.graphql(`
  query {
    locations(first: 1) {
      edges {
        node {
          id
          name
        }
      }
    }
  }
`);

    const locationData = await locationRes.json();
    const locationId = locationData.data.locations.edges[0]?.node?.id;
    console.log('Location ID:', locationId);

    if (!locationId) {
      throw new Error("No location found to set inventory.");
    }

    const setInventoryRes = await admin.graphql(`
  mutation InventorySetQuantities($input: InventorySetQuantitiesInput!) {
    inventorySetQuantities(input: $input) {
      inventoryAdjustmentGroup {
        createdAt
        reason
        changes {
          name
          delta
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`, {
      variables: {
        input: {
          reason: "correction",
          name: "available",
          ignoreCompareQuantity: true,  // ✅ ADD THIS
          quantities: [
            {
              inventoryItemId: variant.inventoryItem.id,
              locationId: locationId,
              quantity: 999
            }
          ]
        }
      }
    });

    const setInventoryData = await setInventoryRes.json();
    // console.log('Inventory set response:', setInventoryData);

    // Check for errors
    if (setInventoryData.data.inventorySetQuantities.userErrors.length > 0) {
      console.error('Inventory errors:', setInventoryData.data.inventorySetQuantities.userErrors);
      throw new Error(`Failed to set inventory: ${JSON.stringify(setInventoryData.data.inventorySetQuantities.userErrors)}`);
    }

    // ============================================
    // 5️⃣ SAVE CONFIGURATION TO DATABASE
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

    console.log('Configuration saved:', orderConfig.id);

    // ============================================
    // ✅ RETURN SUCCESS
    // ============================================
    return json({
      success: true,
      message: "Product created and ready for Add to Cart",
      shopifyProduct: {
        id: createdProduct.id,
        title: finalTitle,
        handle: createdProduct.handle,
        variantId: variant.id,
      },
      configurationId: orderConfig.id,
      quantity: quantity || 1,
      calculatedPrice: calculatedPrice,
    });

  } catch (error) {
    console.error("Cart API Error:", error);
    return json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
};

// Helper function for testing
async function createTestProduct(admin) {
  const createRes = await admin.graphql(`
    mutation {
      productCreate(
        input: {
          title: "Test Product - App Proxy",
          status: ACTIVE
        },
        media: [{
          originalSource: "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_large.png",
          mediaContentType: IMAGE,
          alt: "Test product image"
        }]
      ) {
        product {
          id
          title
          handle
          variants(first: 1) {
            edges {
              node {
                id
              }
            }
          }
        }
        userErrors { message }
      }
    }
  `);

  const createData = await createRes.json();
  return createData;
}