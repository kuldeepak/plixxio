import { useState, useEffect } from "react";
import { useFetcher, useNavigate, useParams } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { json } from "@remix-run/node";
// import { PrismaClient } from "@prisma/client";

// const prisma = new PrismaClient();
import prisma from "../db.server";

export const loader = async ({ request, params }) => {
  await authenticate.admin(request);

  const productId = params.id;

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
    },
  });

  return json({ product });
};

export const action = async ({ request, params }) => {
  await authenticate.admin(request);

  const formData = await request.formData();
  const actionType = formData.get("action");
  const productId = params.id;

  try {
    // ============================================
    // CREATE STEP
    // ============================================
    if (actionType === "createStep") {
      const key = formData.get("key");
      const type = formData.get("type");
      const title = formData.get("title");
      const subtitle = formData.get("subtitle") || "";
      const description = formData.get("description") || "";
      const image = formData.get("image") || "";

      // Get current max order
      const maxOrderStep = await prisma.configurationStep.findFirst({
        where: { productId },
        orderBy: { order: "desc" },
      });
      const order = (maxOrderStep?.order || 0) + 1;

      // For measurement type
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

    // ============================================
    // CREATE OPTION
    // ============================================
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

    // ============================================
    // DELETE STEP
    // ============================================
    if (actionType === "deleteStep") {
      const stepId = formData.get("stepId");

      await prisma.configurationStep.delete({
        where: { id: stepId },
      });

      return json({ success: true });
    }

    // ============================================
    // DELETE OPTION
    // ============================================
    if (actionType === "deleteOption") {
      const optionId = formData.get("optionId");

      await prisma.stepOption.delete({
        where: { id: optionId },
      });

      return json({ success: true });
    }

    return json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Action Error:", error);
    return json({ success: false, error: error.message }, { status: 500 });
  }
};

export default function ConfigureProduct() {
  const { product } = useLoaderData();
  const fetcher = useFetcher();
  const navigate = useNavigate();
  const shopify = useAppBridge();
  const params = useParams();

  const [showStepForm, setShowStepForm] = useState(false);
  const [showOptionForm, setShowOptionForm] = useState(null); // stepId
  const [stepFormData, setStepFormData] = useState({
    key: "",
    type: "OPTIONS",
    title: "",
    subtitle: "",
    description: "",
    image: "",
    widthMin: "",
    widthMax: "",
    heightMin: "",
    heightMax: "",
  });
  const [optionFormData, setOptionFormData] = useState({
    value: "",
    label: "",
    description: "",
    image: "",
    price: "0",
    showSteps: "",
  });

  const isLoading = ["loading", "submitting"].includes(fetcher.state);

  useEffect(() => {
    if (fetcher.data?.success) {
      shopify.toast.show("Success!");
      setShowStepForm(false);
      setShowOptionForm(null);
      // Reset forms
      setStepFormData({
        key: "",
        type: "OPTIONS",
        title: "",
        subtitle: "",
        description: "",
        image: "",
        widthMin: "",
        widthMax: "",
        heightMin: "",
        heightMax: "",
      });
      setOptionFormData({
        value: "",
        label: "",
        description: "",
        image: "",
        price: "0",
        showSteps: "",
      });
      // Reload page
      window.location.reload();
    } else if (fetcher.data?.error) {
      shopify.toast.show(`Error: ${fetcher.data.error}`);
    }
  }, [fetcher.data, shopify]);

  const handleCreateStep = () => {
    const submitData = new FormData();
    submitData.append("action", "createStep");
    submitData.append("key", stepFormData.key);
    submitData.append("type", stepFormData.type);
    submitData.append("title", stepFormData.title);
    submitData.append("subtitle", stepFormData.subtitle);
    submitData.append("description", stepFormData.description);
    submitData.append("image", stepFormData.image);

    if (stepFormData.type === "MEASUREMENT") {
      submitData.append("widthMin", stepFormData.widthMin);
      submitData.append("widthMax", stepFormData.widthMax);
      submitData.append("heightMin", stepFormData.heightMin);
      submitData.append("heightMax", stepFormData.heightMax);
    }

    fetcher.submit(submitData, { method: "POST" });
  };

  const handleCreateOption = (stepId) => {
    const submitData = new FormData();
    submitData.append("action", "createOption");
    submitData.append("stepId", stepId);
    submitData.append("value", optionFormData.value);
    submitData.append("label", optionFormData.label);
    submitData.append("description", optionFormData.description);
    submitData.append("image", optionFormData.image);
    submitData.append("price", optionFormData.price);
    submitData.append("showSteps", optionFormData.showSteps);

    fetcher.submit(submitData, { method: "POST" });
  };

  const handleDeleteStep = (stepId) => {
    if (confirm("Are you sure you want to delete this step?")) {
      const submitData = new FormData();
      submitData.append("action", "deleteStep");
      submitData.append("stepId", stepId);
      fetcher.submit(submitData, { method: "POST" });
    }
  };

  const handleDeleteOption = (optionId) => {
    if (confirm("Are you sure you want to delete this option?")) {
      const submitData = new FormData();
      submitData.append("action", "deleteOption");
      submitData.append("optionId", optionId);
      fetcher.submit(submitData, { method: "POST" });
    }
  };

  if (!product) {
    return (
      <s-page heading="Product Not Found">
        <s-section>
          <s-paragraph>Product not found.</s-paragraph>
          <s-button onClick={() => navigate("/app/configurator")}>
            Back to List
          </s-button>
        </s-section>
      </s-page>
    );
  }

  return (
    <s-page heading={`Configure: ${product.name}`}>
      <s-button
        slot="secondary-action"
        onClick={() => navigate("/app/configurator")}
      >
        Back to List
      </s-button>

      {/* Product Info */}
      <s-section heading="Product Information">
        <s-stack direction="block" gap="tight">
          <s-text>
            <strong>Shopify ID:</strong> {product.shopifyProductId}
          </s-text>
          <s-text>
            <strong>Base Price:</strong> {product.basePrice.toFixed(2)} €
          </s-text>
          <s-text>
            <strong>Total Steps:</strong> {product.steps.length}
          </s-text>
        </s-stack>
      </s-section>

      {/* Steps List */}
      <s-section heading="Configuration Steps">
        <s-stack direction="block" gap="base">
          {product.steps.length === 0 ? (
            <s-box padding="base" borderWidth="base" borderRadius="base">
              <s-paragraph>
                No steps configured yet. Add your first step below.
              </s-paragraph>
            </s-box>
          ) : (
            product.steps.map((step) => (
              <s-box
                key={step.id}
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
                    <s-heading>
                      {step.order}. {step.title}
                    </s-heading>
                    <s-button
                      variant="tertiary"
                      tone="critical"
                      onClick={() => handleDeleteStep(step.id)}
                    >
                      Delete Step
                    </s-button>
                  </s-stack>

                  <s-text>
                    <strong>Key:</strong> {step.key}
                  </s-text>
                  <s-text>
                    <strong>Type:</strong> {step.type}
                  </s-text>
                  {step.subtitle && (
                    <s-text>
                      <strong>Subtitle:</strong> {step.subtitle}
                    </s-text>
                  )}

                  {step.type === "MEASUREMENT" && (
                    <s-stack direction="block" gap="tight">
                      <s-text>
                        <strong>Width:</strong> {step.widthMin} -{" "}
                        {step.widthMax} mm
                      </s-text>
                      <s-text>
                        <strong>Height:</strong> {step.heightMin} -{" "}
                        {step.heightMax} mm
                      </s-text>
                    </s-stack>
                  )}

                  {step.type === "OPTIONS" && (
                    <>
                      <s-heading variant="headingSm">Options:</s-heading>
                      {step.options.length === 0 ? (
                        <s-text tone="subdued">No options yet</s-text>
                      ) : (
                        <s-stack direction="block" gap="tight">
                          {step.options.map((option) => (
                            <s-box
                              key={option.id}
                              padding="tight"
                              background="subdued"
                              borderRadius="base"
                            >
                              <s-stack
                                direction="inline"
                                gap="base"
                                style={{ justifyContent: "space-between" }}
                              >
                                <s-stack direction="block" gap="tight">
                                  <s-text>
                                    <strong>{option.label}</strong> (value:{" "}
                                    {option.value})
                                  </s-text>
                                  <s-text>
                                    Price: +{option.price.toFixed(2)} €
                                  </s-text>
                                  {option.showSteps && (
                                    <s-text variant="bodySm">
                                      Next Steps: {option.showSteps}
                                    </s-text>
                                  )}
                                </s-stack>
                                <s-button
                                  variant="tertiary"
                                  tone="critical"
                                  onClick={() => handleDeleteOption(option.id)}
                                >
                                  Delete
                                </s-button>
                              </s-stack>
                            </s-box>
                          ))}
                        </s-stack>
                      )}

                      <s-button
                        variant="secondary"
                        onClick={() => setShowOptionForm(step.id)}
                      >
                        Add Option to this Step
                      </s-button>

                      {/* Option Form */}
                      {showOptionForm === step.id && (
                        <s-box
                          padding="base"
                          background="subdued"
                          borderRadius="base"
                        >
                          <s-stack direction="block" gap="base">
                            <s-heading variant="headingSm">
                              Add New Option
                            </s-heading>

                            <input
                              type="text"
                              placeholder="Value (e.g., 'normal')"
                              value={optionFormData.value}
                              onChange={(e) =>
                                setOptionFormData({
                                  ...optionFormData,
                                  value: e.target.value,
                                })
                              }
                              style={{
                                width: "100%",
                                padding: "8px",
                                border: "1px solid #c9cccf",
                                borderRadius: "4px",
                              }}
                            />

                            <input
                              type="text"
                              placeholder="Label (e.g., 'Normal Window')"
                              value={optionFormData.label}
                              onChange={(e) =>
                                setOptionFormData({
                                  ...optionFormData,
                                  label: e.target.value,
                                })
                              }
                              style={{
                                width: "100%",
                                padding: "8px",
                                border: "1px solid #c9cccf",
                                borderRadius: "4px",
                              }}
                            />

                            <input
                              type="text"
                              placeholder="Description"
                              value={optionFormData.description}
                              onChange={(e) =>
                                setOptionFormData({
                                  ...optionFormData,
                                  description: e.target.value,
                                })
                              }
                              style={{
                                width: "100%",
                                padding: "8px",
                                border: "1px solid #c9cccf",
                                borderRadius: "4px",
                              }}
                            />

                            <input
                              type="text"
                              placeholder="Image URL"
                              value={optionFormData.image}
                              onChange={(e) =>
                                setOptionFormData({
                                  ...optionFormData,
                                  image: e.target.value,
                                })
                              }
                              style={{
                                width: "100%",
                                padding: "8px",
                                border: "1px solid #c9cccf",
                                borderRadius: "4px",
                              }}
                            />

                            <input
                              type="number"
                              step="0.01"
                              placeholder="Price (addon)"
                              value={optionFormData.price}
                              onChange={(e) =>
                                setOptionFormData({
                                  ...optionFormData,
                                  price: e.target.value,
                                })
                              }
                              style={{
                                width: "100%",
                                padding: "8px",
                                border: "1px solid #c9cccf",
                                borderRadius: "4px",
                              }}
                            />

                            <input
                              type="text"
                              placeholder='Show Steps (JSON: ["step1", "step2"])'
                              value={optionFormData.showSteps}
                              onChange={(e) =>
                                setOptionFormData({
                                  ...optionFormData,
                                  showSteps: e.target.value,
                                })
                              }
                              style={{
                                width: "100%",
                                padding: "8px",
                                border: "1px solid #c9cccf",
                                borderRadius: "4px",
                              }}
                            />

                            <s-stack direction="inline" gap="base">
                              <s-button
                                onClick={() => handleCreateOption(step.id)}
                                {...(isLoading ? { loading: true } : {})}
                              >
                                Save Option
                              </s-button>
                              <s-button
                                variant="tertiary"
                                onClick={() => setShowOptionForm(null)}
                              >
                                Cancel
                              </s-button>
                            </s-stack>
                          </s-stack>
                        </s-box>
                      )}
                    </>
                  )}
                </s-stack>
              </s-box>
            ))
          )}

          {/* Add Step Button */}
          <s-button onClick={() => setShowStepForm(!showStepForm)}>
            {showStepForm ? "Cancel" : "Add New Step"}
          </s-button>

          {/* Step Form */}
          {showStepForm && (
            <s-box padding="base" background="subdued" borderRadius="base">
              <s-stack direction="block" gap="base">
                <s-heading>Create New Step</s-heading>

                <input
                  type="text"
                  placeholder="Key (e.g., 'fenstertyp')"
                  value={stepFormData.key}
                  onChange={(e) =>
                    setStepFormData({ ...stepFormData, key: e.target.value })
                  }
                  style={{
                    width: "100%",
                    padding: "8px",
                    border: "1px solid #c9cccf",
                    borderRadius: "4px",
                  }}
                />

                <select
                  value={stepFormData.type}
                  onChange={(e) =>
                    setStepFormData({ ...stepFormData, type: e.target.value })
                  }
                  style={{
                    width: "100%",
                    padding: "8px",
                    border: "1px solid #c9cccf",
                    borderRadius: "4px",
                  }}
                >
                  <option value="OPTIONS">Options</option>
                  <option value="MEASUREMENT">Measurement</option>
                </select>

                <input
                  type="text"
                  placeholder="Title"
                  value={stepFormData.title}
                  onChange={(e) =>
                    setStepFormData({ ...stepFormData, title: e.target.value })
                  }
                  style={{
                    width: "100%",
                    padding: "8px",
                    border: "1px solid #c9cccf",
                    borderRadius: "4px",
                  }}
                />

                <input
                  type="text"
                  placeholder="Subtitle"
                  value={stepFormData.subtitle}
                  onChange={(e) =>
                    setStepFormData({
                      ...stepFormData,
                      subtitle: e.target.value,
                    })
                  }
                  style={{
                    width: "100%",
                    padding: "8px",
                    border: "1px solid #c9cccf",
                    borderRadius: "4px",
                  }}
                />

                <input
                  type="text"
                  placeholder="Description"
                  value={stepFormData.description}
                  onChange={(e) =>
                    setStepFormData({
                      ...stepFormData,
                      description: e.target.value,
                    })
                  }
                  style={{
                    width: "100%",
                    padding: "8px",
                    border: "1px solid #c9cccf",
                    borderRadius: "4px",
                  }}
                />

                <input
                  type="text"
                  placeholder="Image URL"
                  value={stepFormData.image}
                  onChange={(e) =>
                    setStepFormData({ ...stepFormData, image: e.target.value })
                  }
                  style={{
                    width: "100%",
                    padding: "8px",
                    border: "1px solid #c9cccf",
                    borderRadius: "4px",
                  }}
                />

                {stepFormData.type === "MEASUREMENT" && (
                  <>
                    <s-heading variant="headingSm">
                      Measurement Ranges
                    </s-heading>
                    <s-stack direction="inline" gap="base">
                      <input
                        type="number"
                        placeholder="Width Min (mm)"
                        value={stepFormData.widthMin}
                        onChange={(e) =>
                          setStepFormData({
                            ...stepFormData,
                            widthMin: e.target.value,
                          })
                        }
                        style={{
                          width: "48%",
                          padding: "8px",
                          border: "1px solid #c9cccf",
                          borderRadius: "4px",
                        }}
                      />
                      <input
                        type="number"
                        placeholder="Width Max (mm)"
                        value={stepFormData.widthMax}
                        onChange={(e) =>
                          setStepFormData({
                            ...stepFormData,
                            widthMax: e.target.value,
                          })
                        }
                        style={{
                          width: "48%",
                          padding: "8px",
                          border: "1px solid #c9cccf",
                          borderRadius: "4px",
                        }}
                      />
                    </s-stack>
                    <s-stack direction="inline" gap="base">
                      <input
                        type="number"
                        placeholder="Height Min (mm)"
                        value={stepFormData.heightMin}
                        onChange={(e) =>
                          setStepFormData({
                            ...stepFormData,
                            heightMin: e.target.value,
                          })
                        }
                        style={{
                          width: "48%",
                          padding: "8px",
                          border: "1px solid #c9cccf",
                          borderRadius: "4px",
                        }}
                      />
                      <input
                        type="number"
                        placeholder="Height Max (mm)"
                        value={stepFormData.heightMax}
                        onChange={(e) =>
                          setStepFormData({
                            ...stepFormData,
                            heightMax: e.target.value,
                          })
                        }
                        style={{
                          width: "48%",
                          padding: "8px",
                          border: "1px solid #c9cccf",
                          borderRadius: "4px",
                        }}
                      />
                    </s-stack>
                  </>
                )}

                <s-stack direction="inline" gap="base">
                  <s-button
                    onClick={handleCreateStep}
                    {...(isLoading ? { loading: true } : {})}
                  >
                    Create Step
                  </s-button>
                  <s-button
                    variant="tertiary"
                    onClick={() => setShowStepForm(false)}
                  >
                    Cancel
                  </s-button>
                </s-stack>
              </s-stack>
            </s-box>
          )}
        </s-stack>
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};