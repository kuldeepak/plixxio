import { useState, useEffect, useRef } from "react";
import {
  useFetcher,
  useNavigate,
  useParams,
  useLoaderData,
  useRevalidator,
} from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { json } from "@remix-run/node";
import { DndContext } from "@dnd-kit/core";
import { SortableContext, arrayMove } from "@dnd-kit/sortable";
import { SortableItem } from "../components/SortableItem";

const inputStyle = {
  width: "95%",
  padding: "10px 12px",
  border: "1px solid #c9cccf",
  borderRadius: "6px",
  fontSize: "14px",
};

import prisma from "../db.server";
import "react-quill/dist/quill.snow.css";

let ReactQuill = null;

export const loader = async ({ request, params }) => {
  await authenticate.admin(request);

  const productId = params.productId;

  const product = await prisma.product.findUnique({
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

  return json({ product });
};

const getNullable = (value) => {
  if (
    value === undefined ||
    value === null ||
    value === "" ||
    value === "undefined"
  ) {
    return null;
  }
  return value;
};

const modules = {
  toolbar: [
    [{ header: [1, 2, 3, 4, 5, 6, false] }],
    ["bold", "italic", "underline", "strike"],
    [{ color: [] }, { background: [] }],
    [{ script: "sub" }, { script: "super" }],
    [{ list: "ordered" }, { list: "bullet" }],
    [{ indent: "-1" }, { indent: "+1" }],
    [{ align: [] }],
    ["link", "image", "video"],
    ["blockquote", "code-block"],
    ["clean"],
  ],
};

export const action = async ({ request, params }) => {
  await authenticate.admin(request);

  const formData = await request.formData();
  const actionType = formData.get("action");
  const productId = params.productId;

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

      const maxOrderStep = await prisma.configurationStep.findFirst({
        where: { productId },
        orderBy: { order: "desc" },
      });
      const order = (maxOrderStep?.order || 0) + 1;

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

      const measurementMode = formData.get("measurementMode") || "NORMAL";

      const flugelMin = formData.get("flugelMin")
        ? parseInt(formData.get("flugelMin"))
        : null;

      const flugelMax = formData.get("flugelMax")
        ? parseInt(formData.get("flugelMax"))
        : null;

      // NEW: flugelDependencyOptionId
      const flugelDependencyOptionId = getNullable(formData.get("flugelDependencyOptionId"));

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
          measurementMode,
          flugelMin,
          flugelMax,
          flugelDependencyOptionId,
        },
      });

      return json({ success: true, step });
    }

    // ============================================
    // UPDATE STEP
    // ============================================
    if (actionType === "updateStep") {
      const stepId = formData.get("stepId");
      const key = formData.get("key");
      const type = formData.get("type");
      const title = formData.get("title");
      const subtitle = formData.get("subtitle") || "";
      const description = formData.get("description") || "";
      const image = formData.get("image") || "";

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

      const measurementMode = formData.get("measurementMode") || "NORMAL";

      const flugelMin = formData.get("flugelMin")
        ? parseInt(formData.get("flugelMin"))
        : null;

      const flugelMax = formData.get("flugelMax")
        ? parseInt(formData.get("flugelMax"))
        : null;

      // NEW: flugelDependencyOptionId
      const flugelDependencyOptionId = getNullable(formData.get("flugelDependencyOptionId"));

      const step = await prisma.configurationStep.update({
        where: { id: stepId },
        data: {
          key,
          type,
          title,
          subtitle,
          description,
          image,
          widthMin,
          widthMax,
          heightMin,
          heightMax,
          measurementMode,
          flugelMin,
          flugelMax,
          flugelDependencyOptionId,
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
      const sku = formData.get("sku") || "";
      const showSteps = getNullable(formData.get("showSteps"));
      const parentOptionIds = getNullable(formData.get("parentOptionIds"));

      const maxOrderOption = await prisma.stepOption.findFirst({
        where: { stepId },
        orderBy: { order: "desc" },
      });

      const order = (maxOrderOption?.order || 0) + 1;

      const option = await prisma.stepOption.create({
        data: {
          stepId,
          value,
          label,
          description,
          image,
          price,
          sku,
          showSteps,
          parentOptionIds,
          order,
        },
      });

      return json({ success: true, option });
    }

    // ============================================
    // UPDATE OPTION
    // ============================================
    if (actionType === "updateOption") {
      const optionId = formData.get("optionId");
      const value = formData.get("value");
      const label = formData.get("label");
      const description = formData.get("description") || "";
      const image = formData.get("image") || "";
      const price = parseFloat(formData.get("price") || 0);
      const sku = formData.get("sku") || "";
      const getNullable = (value) => {
        if (
          value === undefined ||
          value === null ||
          value === "" ||
          value === "undefined"
        ) {
          return null;
        }
        return value;
      };

      const showSteps = getNullable(formData.get("showSteps"));
      const parentOptionIds = getNullable(formData.get("parentOptionIds"));

      const option = await prisma.stepOption.update({
        where: { id: optionId },
        data: {
          value,
          label,
          description,
          image,
          price,
          sku,
          showSteps,
          parentOptionIds,
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

    if (actionType === "reorderOptions") {
      const options = JSON.parse(formData.get("options"));

      await Promise.all(
        options.map((opt) =>
          prisma.stepOption.update({
            where: { id: opt.id },
            data: { order: opt.order },
          }),
        ),
      );

      return json({ success: true });
    }

    if (actionType === "reorderSteps") {
      const steps = JSON.parse(formData.get("steps"));

      await Promise.all(
        steps.map((step) =>
          prisma.configurationStep.update({
            where: { id: step.id },
            data: { order: step.order },
          }),
        ),
      );

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

  const stepFormRef = useRef(null);
  const optionFormRefs = useRef({});

  const [showStepForm, setShowStepForm] = useState(false);
  const [editingStep, setEditingStep] = useState(null);
  const [showOptionForm, setShowOptionForm] = useState(null);
  const [editingOption, setEditingOption] = useState(null);

  // NEW: flugelDependencyOptionId added
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
    measurementMode: "NORMAL",
    flugelMin: "",
    flugelMax: "",
    flugelDependencyOptionId: "",
  });

  const handleQuillChange = (field, value) => {
    setStepFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const [optionFormData, setOptionFormData] = useState({
    value: "",
    label: "",
    description: "",
    image: "",
    price: "0",
    sku: "",
    showSteps: "",
    parentOptionIds: [],
  });

  const [uploadingStepImage, setUploadingStepImage] = useState(false);
  const [uploadingOptionImage, setUploadingOptionImage] = useState(false);

  const isLoading = ["loading", "submitting"].includes(fetcher.state);
  const revalidator = useRevalidator();

  useEffect(() => {
    if (fetcher.data?.success) {
      shopify.toast.show("Success!");
      resetForms();
      revalidator.revalidate();
    } else if (fetcher.data?.error) {
      shopify.toast.show(`Error: ${fetcher.data.error}`);
    }
  }, [fetcher.data, shopify]);

  // NEW: flugelDependencyOptionId reset added
  const resetForms = () => {
    setShowStepForm(false);
    setEditingStep(null);
    setShowOptionForm(null);
    setEditingOption(null);
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
      measurementMode: "NORMAL",
      flugelMin: "",
      flugelMax: "",
      flugelDependencyOptionId: "",
    });
    setOptionFormData({
      value: "",
      label: "",
      description: "",
      image: "",
      price: "0",
      sku: "",
      showSteps: "",
    });
  };

  const handleStepImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingStepImage(true);
    const uploadFormData = new FormData();
    uploadFormData.append("image", file);

    try {
      const response = await fetch("/api/upload-image", {
        method: "POST",
        body: uploadFormData,
      });

      const data = await response.json();

      if (data.success) {
        setStepFormData({ ...stepFormData, image: data.imageUrl });
        shopify.toast.show("Bild erfolgreich hochgeladen.");
      } else {
        shopify.toast.show(`Upload failed: ${data.error}`);
      }
    } catch (error) {
      shopify.toast.show(`Upload error: ${error.message}`);
    } finally {
      setUploadingStepImage(false);
    }
  };

  const handleOptionImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingOptionImage(true);
    const uploadFormData = new FormData();
    uploadFormData.append("image", file);

    try {
      const response = await fetch("/api/upload-image", {
        method: "POST",
        body: uploadFormData,
      });

      const data = await response.json();
      if (data.success) {
        setOptionFormData({ ...optionFormData, image: data.imageUrl });
        shopify.toast.show("Bild erfolgreich hochgeladen");
      } else {
        shopify.toast.show(`Upload failed: ${data.error}`);
      }
    } catch (error) {
      shopify.toast.show(`Upload error: ${error.message}`);
    } finally {
      setUploadingOptionImage(false);
    }
  };

  // NEW: flugelDependencyOptionId load in edit
  const handleEditStep = (step) => {
    setEditingStep(step);
    setStepFormData({
      key: step.key,
      type: step.type,
      title: step.title,
      subtitle: step.subtitle || "",
      description: step.description || "",
      image: step.image || "",
      widthMin: step.widthMin?.toString() || "",
      widthMax: step.widthMax?.toString() || "",
      heightMin: step.heightMin?.toString() || "",
      heightMax: step.heightMax?.toString() || "",
      measurementMode: step.measurementMode || "NORMAL",
      flugelMin: step.flugelMin?.toString() || "",
      flugelMax: step.flugelMax?.toString() || "",
      flugelDependencyOptionId: step.flugelDependencyOptionId || "",
    });
    setShowStepForm(true);

    setTimeout(() => {
      stepFormRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
        inline: "nearest",
      });
    }, 100);
  };

  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    import("react-quill").then((mod) => {
      ReactQuill = mod.default;
    });
  }, []);

  const handleEditOption = (option, stepId) => {
    setEditingOption(option);
    setOptionFormData({
      value: option.value,
      label: option.label,
      description: option.description || "",
      image: option.image || "",
      price: option.price.toString(),
      sku: option.sku || "",
      showSteps: option.showSteps || "",
      parentOptionIds: option.parentOptionIds
        ? JSON.parse(option.parentOptionIds)
        : [],
    });

    setTimeout(() => {
      optionFormRefs.current[stepId]?.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "nearest",
      });
    }, 100);
  };

  // NEW: flugelDependencyOptionId submit added
  const handleSaveStep = () => {
    const submitData = new FormData();
    submitData.append("action", editingStep ? "updateStep" : "createStep");
    if (editingStep) submitData.append("stepId", editingStep.id);
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
      submitData.append("measurementMode", stepFormData.measurementMode);
      submitData.append("flugelMin", stepFormData.flugelMin);
      submitData.append("flugelMax", stepFormData.flugelMax);
      submitData.append("flugelDependencyOptionId", stepFormData.flugelDependencyOptionId || "");
    }

    fetcher.submit(submitData, { method: "POST" });
  };

  const handleSaveOption = (stepId) => {
    const submitData = new FormData();
    submitData.append(
      "action",
      editingOption ? "updateOption" : "createOption",
    );
    if (editingOption) submitData.append("optionId", editingOption.id);
    submitData.append("stepId", stepId);
    submitData.append("value", optionFormData.value);
    submitData.append("label", optionFormData.label);
    submitData.append("description", optionFormData.description);
    submitData.append("image", optionFormData.image);
    submitData.append("price", optionFormData.price);
    submitData.append("sku", optionFormData.sku);
    submitData.append("showSteps", optionFormData.showSteps);
    submitData.append(
      "parentOptionIds",
      JSON.stringify(optionFormData.parentOptionIds),
    );

    fetcher.submit(submitData, { method: "POST" });
  };

  const handleDeleteStep = (stepId) => {
    if (
      confirm(
        "Sind Sie sicher, dass Sie diesen Konfigurationsschritt löschen möchten? abei werden auch alle darin enthaltenen Optionen gelöscht.",
      )
    ) {
      const submitData = new FormData();
      submitData.append("action", "deleteStep");
      submitData.append("stepId", stepId);
      fetcher.submit(submitData, { method: "POST" });
    }
  };

  const handleDeleteOption = (optionId) => {
    if (confirm("Sind Sie sicher, dass Sie diese Option löschen möchten?")) {
      const submitData = new FormData();
      submitData.append("action", "deleteOption");
      submitData.append("optionId", optionId);
      fetcher.submit(submitData, { method: "POST" });
    }
  };

  const handleOptionDragEnd = (event, step) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = step.options.findIndex((o) => o.id === active.id);
    const newIndex = step.options.findIndex((o) => o.id === over.id);

    const newOrder = arrayMove(step.options, oldIndex, newIndex);

    const formatted = newOrder.map((opt, index) => ({
      id: opt.id,
      order: index + 1,
    }));

    const formData = new FormData();
    formData.append("action", "reorderOptions");
    formData.append("options", JSON.stringify(formatted));

    fetcher.submit(formData, { method: "POST" });
  };

  const handleStepDragEnd = (event) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = product.steps.findIndex((s) => s.id === active.id);
    const newIndex = product.steps.findIndex((s) => s.id === over.id);

    const newOrder = arrayMove(product.steps, oldIndex, newIndex);

    const formatted = newOrder.map((step, index) => ({
      id: step.id,
      order: index + 1,
    }));

    const formData = new FormData();
    formData.append("action", "reorderSteps");
    formData.append("steps", JSON.stringify(formatted));

    fetcher.submit(formData, { method: "POST" });
  };

  if (!product) {
    return (
      <s-page heading="Produkt nicht gefunden">
        <s-section>
          <s-paragraph>Produkt nicht gefunden.</s-paragraph>
          <s-button onClick={() => navigate("/app/configurator")}>
            Zurück zur Produktliste
          </s-button>
        </s-section>
      </s-page>
    );
  }

  // NEW: collect all options from all steps for dependency dropdown
  const allProductOptions = (product?.steps || []).flatMap((s) =>
    (s.options || []).map((opt) => ({
      ...opt,
      stepTitle: s.title?.replace(/<[^>]*>/g, "") || s.key,
      stepId: s.id,
    }))
  );

  return (
    <s-page heading={`Produktkonfiguration: ${product.name}`}>
      <div style={{ marginBottom: "15px" }}>
        <s-button
          slot="secondary-action"
          onClick={() => navigate("/app/configurator")}
        >
          ← Zurück zu den Produkten
        </s-button>
      </div>
      {/* Product Overview Card */}
      <s-section>
        <s-box
          padding="base"
          borderWidth="base"
          borderRadius="base"
          background="surface"
        >
          <s-stack direction="block" gap="tight">
            <div style={{ marginBottom: "15px" }}>
              <s-heading variant="headingMd">Produktübersicht </s-heading>
            </div>
            <s-divider />
            <div style={{ marginTop: "15px" }}>
              <s-stack
                direction="inline"
                gap="loose"
                style={{ marginTop: "15px" }}
              >
                <div style={{ flex: 1 }}>
                  <s-text variant="bodySm" tone="subdued">
                    Shopify Product ID{" "}
                  </s-text>
                  <s-text variant="bodyMd">
                    <strong>{product.shopifyProductId}</strong>
                  </s-text>
                </div>
                <div style={{ flex: 1 }}>
                  <s-text variant="bodySm" tone="subdued">
                    Grundpreis{" "}
                  </s-text>
                  <s-text variant="bodyMd">
                    <strong>€{product.basePrice.toFixed(2)}</strong>
                  </s-text>
                </div>
                <div style={{ flex: 1 }}>
                  <s-text variant="bodySm" tone="subdued">
                    Konfigurationsschritte{" "}
                  </s-text>
                  <s-text variant="bodyMd">
                    <strong>{product.steps.length}</strong>
                  </s-text>
                </div>
              </s-stack>
            </div>
          </s-stack>
        </s-box>
      </s-section>

      {/* Configuration Steps Section */}
      <s-section>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "16px",
          }}
        >
          <s-heading variant="headingLg">Konfigurationsschritte </s-heading>
          <s-button
            variant="primary"
            onClick={() => {
              const willShow = !showStepForm;
              setShowStepForm(willShow);
              setEditingStep(null);
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
                measurementMode: "NORMAL",
                flugelMin: "",
                flugelMax: "",
                flugelDependencyOptionId: "",
              });

              if (willShow) {
                setTimeout(() => {
                  stepFormRef.current?.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                    inline: "nearest",
                  });
                }, 100);
              }
            }}
          >
            {showStepForm ? "✕ Abbrechen" : "+ Schritt hinzufügen"}
          </s-button>
        </div>

        <s-stack direction="block" gap="base">
          {/* Step Form */}
          {showStepForm && (
            <div ref={stepFormRef} style={{ scrollMarginTop: "20px" }}>
              <s-box
                padding="loose"
                borderWidth="base"
                borderRadius="base"
                background="surface-subdued"
                style={{
                  boxShadow: editingStep
                    ? "0 0 0 3px rgba(0, 128, 96, 0.3)"
                    : "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
                  transition: "box-shadow 0.3s ease",
                }}
              >
                <s-stack direction="block" gap="base">
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "10px",
                    }}
                  >
                    <s-heading variant="headingMd">
                      {editingStep ? "✏️ Schritt ändern" : "➕ Schritt anlegen"}
                    </s-heading>
                    <s-badge tone="info">
                      {editingStep ? "Bearbeitungsmodus" : "Neuer Schritt"}
                    </s-badge>
                  </div>

                  <s-divider />

                  {/* Step Type Selection */}
                  <div style={{ padding: "10px" }}>
                    <s-text variant="bodyMd">
                      <strong>Schritttyp </strong>
                    </s-text>
                    <s-text variant="bodySm" tone="subdued">
                      Wählen Sie aus, wie Kunden mit diesem Schritt interagieren sollen
                    </s-text>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr 1fr",
                        gap: "12px",
                        marginTop: "8px",
                      }}
                    >
                      <div
                        onClick={() =>
                          setStepFormData({ ...stepFormData, type: "OPTIONS" })
                        }
                        style={{
                          padding: "16px",
                          border: stepFormData.type === "OPTIONS" ? "2px solid #008060" : "2px solid #e1e3e5",
                          borderRadius: "8px",
                          cursor: "pointer",
                          backgroundColor: stepFormData.type === "OPTIONS" ? "#f6f6f7" : "#fff",
                          transition: "all 0.2s",
                        }}
                      >
                        <div style={{ fontSize: "24px", marginBottom: "8px" }}>📋</div>
                        <s-text variant="bodyMd"><strong>Mehrfachauswahl </strong></s-text>
                        <s-text variant="bodySm" tone="subdued">
                          Kunden können aus vordefinierten Optionen auswählen{" "}
                        </s-text>
                      </div>
                      <div
                        onClick={() =>
                          setStepFormData({ ...stepFormData, type: "MEASUREMENT" })
                        }
                        style={{
                          padding: "16px",
                          border: stepFormData.type === "MEASUREMENT" ? "2px solid #008060" : "2px solid #e1e3e5",
                          borderRadius: "8px",
                          cursor: "pointer",
                          backgroundColor: stepFormData.type === "MEASUREMENT" ? "#f6f6f7" : "#fff",
                          transition: "all 0.2s",
                        }}
                      >
                        <div style={{ fontSize: "24px", marginBottom: "8px" }}>📏</div>
                        <s-text variant="bodyMd"><strong>Maße </strong></s-text>
                        <s-text variant="bodySm" tone="subdued">
                          Kunden geben eine individuelle Breite und Höhe ein.
                        </s-text>
                      </div>
                      <div
                        onClick={() =>
                          setStepFormData({ ...stepFormData, type: "DROPDOWN" })
                        }
                        style={{
                          padding: "16px",
                          border: stepFormData.type === "DROPDOWN" ? "2px solid #008060" : "2px solid #e1e3e5",
                          borderRadius: "8px",
                          cursor: "pointer",
                          backgroundColor: stepFormData.type === "DROPDOWN" ? "#f6f6f7" : "#fff",
                          transition: "all 0.2s",
                        }}
                      >
                        <div style={{ fontSize: "24px", marginBottom: "8px" }}>🔽</div>
                        <s-text variant="bodyMd"><strong>Dropdown</strong></s-text>
                        <s-text variant="bodySm" tone="subdued">
                          Kunden wählen aus einer Dropdown-Liste
                        </s-text>
                      </div>
                    </div>
                  </div>

                  {/* Basic Information */}
                  <div style={{ background: "#f9fafb", padding: "16px", borderRadius: "8px" }}>
                    <s-text variant="bodyMd"><strong>📝 Grundinformationen </strong></s-text>
                    <s-stack direction="block" gap="base" style={{ marginTop: "12px" }}>
                      <div>
                        <label style={{ display: "block", marginBottom: "4px" }}>
                          <s-text variant="bodySm">
                            <strong>Anzeigetitel</strong>{" "}
                            <span style={{ color: "#bf0711" }}>*</span>
                          </s-text>
                        </label>
                        <s-text variant="bodySm" tone="subdued">
                          Was Kunden sehen (e.g., "Fenstertyp", "Farbe auswählen")
                        </s-text>
                        <div style={{ marginTop: "6px" }}>
                          {isClient && ReactQuill && (
                            <ReactQuill
                              value={stepFormData.title || ""}
                              onChange={(value) => handleQuillChange("title", value)}
                              placeholder="e.g., Window Type"
                              modules={modules}
                              style={{ width: "95%", background: "#fff", borderRadius: "6px" }}
                            />
                          )}
                        </div>
                      </div>

                      <div>
                        <label style={{ display: "block", marginBottom: "4px" }}>
                          <s-text variant="bodySm">
                            <strong>Interner Schlüssel </strong>{" "}
                            <span style={{ color: "#bf0711" }}>*</span>
                          </s-text>
                        </label>
                        <s-text variant="bodySm" tone="subdued">
                          Eindeutiger Bezeichner (kleingeschrieben, keine Leerzeichen, e.g., "window_type")
                        </s-text>
                        <input
                          type="text"
                          value={stepFormData.key}
                          onChange={(e) =>
                            setStepFormData({
                              ...stepFormData,
                              key: e.target.value.toLowerCase().replace(/\s/g, "_"),
                            })
                          }
                          placeholder="e.g., window_type"
                          required
                          style={{
                            width: "95%",
                            padding: "10px 12px",
                            border: "1px solid #c9cccf",
                            borderRadius: "6px",
                            marginTop: "6px",
                            fontSize: "14px",
                            fontFamily: "monospace",
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ display: "block", marginBottom: "4px" }}>
                          <s-text variant="bodySm"><strong>Untertitel</strong> (Optional)</s-text>
                        </label>
                        <s-text variant="bodySm" tone="subdued">
                          Schritt-Fortschrittsanzeige (e.g., "Schritt 1 von 3")
                        </s-text>
                        <div className="custom-quill-wrapper" style={{ marginTop: "12px" }}>
                          <ReactQuill
                            value={stepFormData.subtitle || ""}
                            onChange={(value) => handleQuillChange("subtitle", value)}
                            placeholder="e.g., Choose your style"
                            modules={modules}
                          />
                        </div>
                      </div>

                      <div>
                        <label style={{ display: "block", marginBottom: "4px" }}>
                          <s-text variant="bodySm"><strong>Beschreibung</strong> (Optional)</s-text>
                        </label>
                        <s-text variant="bodySm" tone="subdued">
                          Zusätzlicher Hilfetext für Kunden{" "}
                        </s-text>
                        <div className="custom-quill-wrapper" style={{ marginTop: "12px" }}>
                          {isClient && ReactQuill && (
                            <ReactQuill
                              value={stepFormData.description || ""}
                              onChange={(value) => handleQuillChange("description", value)}
                              placeholder="Enter description..."
                              modules={modules}
                            />
                          )}
                        </div>
                      </div>

                      <div>
                        <label style={{ display: "block", marginBottom: "4px" }}>
                          <s-text variant="bodySm"><strong>🖼️ Schrittbild</strong> (Optional)</s-text>
                        </label>
                        <s-text variant="bodySm" tone="subdued">
                          Laden Sie ein Bild hoch, das oben in diesem Schritt angezeigt wird{" "}
                        </s-text>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleStepImageUpload}
                          disabled={uploadingStepImage}
                          style={{
                            width: "95%",
                            padding: "10px 12px",
                            border: "2px dashed #c9cccf",
                            borderRadius: "6px",
                            marginTop: "6px",
                            backgroundColor: "#fff",
                            cursor: "pointer",
                          }}
                        />
                        {uploadingStepImage && (
                          <div style={{ marginTop: "8px", display: "flex", alignItems: "center", gap: "8px" }}>
                            <s-spinner size="small" />
                            <s-text variant="bodySm">Bild wird hochgeladen...</s-text>
                          </div>
                        )}
                        {stepFormData.image && (
                          <div style={{ marginTop: "12px", position: "relative", display: "inline-block" }}>
                            <img
                              src={stepFormData.image}
                              alt="Preview"
                              style={{
                                maxWidth: "250px",
                                maxHeight: "200px",
                                borderRadius: "6px",
                                border: "1px solid #e1e3e5",
                              }}
                            />
                            <button
                              onClick={() => setStepFormData({ ...stepFormData, image: "" })}
                              style={{
                                position: "absolute",
                                top: "8px",
                                right: "8px",
                                background: "rgba(0,0,0,0.7)",
                                color: "white",
                                border: "none",
                                borderRadius: "50%",
                                width: "24px",
                                height: "24px",
                                cursor: "pointer",
                                fontSize: "14px",
                              }}
                            >
                              ✕
                            </button>
                          </div>
                        )}
                      </div>
                    </s-stack>
                  </div>

                  {/* ============================================
                      MEASUREMENT SECTION — UPDATED WITH FLUGEL DEPENDENCY
                  ============================================ */}
                  {stepFormData.type === "MEASUREMENT" && (
                    <div style={{ background: "#f9fafb", padding: "16px", borderRadius: "8px" }}>
                      <s-text variant="bodyMd">
                        <strong>📏 Messbereiche (in Millimetern)</strong>
                      </s-text>
                      <s-text variant="bodySm" tone="subdued">
                        Legen Sie die minimalen und maximalen Werte fest, die Kunden eingeben können.
                      </s-text>

                      {/* WIDTH + HEIGHT GRID */}
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: "16px",
                          marginTop: "12px",
                        }}
                      >
                        <div>
                          <label>
                            <s-text variant="bodySm"><strong>Breite – Minimum (mm)</strong></s-text>
                          </label>
                          <input
                            type="number"
                            value={stepFormData.widthMin}
                            onChange={(e) => setStepFormData({ ...stepFormData, widthMin: e.target.value })}
                            placeholder="e.g., 300"
                            style={inputStyle}
                          />
                        </div>

                        <div>
                          <label>
                            <s-text variant="bodySm"><strong>Breite – Maximum (mm)</strong></s-text>
                          </label>
                          <input
                            type="number"
                            value={stepFormData.widthMax}
                            onChange={(e) => setStepFormData({ ...stepFormData, widthMax: e.target.value })}
                            placeholder="e.g., 2000"
                            style={inputStyle}
                          />
                        </div>

                        <div>
                          <label>
                            <s-text variant="bodySm"><strong>Höhe – Minimum (mm)</strong></s-text>
                          </label>
                          <input
                            type="number"
                            value={stepFormData.heightMin}
                            onChange={(e) => setStepFormData({ ...stepFormData, heightMin: e.target.value })}
                            placeholder="e.g., 400"
                            style={inputStyle}
                          />
                        </div>

                        <div>
                          <label>
                            <s-text variant="bodySm"><strong>Höhe – Maximum (mm)</strong></s-text>
                          </label>
                          <input
                            type="number"
                            value={stepFormData.heightMax}
                            onChange={(e) => setStepFormData({ ...stepFormData, heightMax: e.target.value })}
                            placeholder="e.g., 2000"
                            style={inputStyle}
                          />
                        </div>
                      </div>

                      {/* MEASUREMENT MODE */}
                      <div style={{ marginTop: "20px" }}>
                        <label>
                          <s-text variant="bodySm"><strong>Measurement Mode</strong></s-text>
                        </label>
                        <select
                          value={stepFormData.measurementMode || "NORMAL"}
                          onChange={(e) =>
                            setStepFormData({
                              ...stepFormData,
                              measurementMode: e.target.value,
                              // reset flugel fields when switching mode
                              flugelMin: "",
                              flugelMax: "",
                              flugelDependencyOptionId: "",
                            })
                          }
                          style={{
                            width: "95%",
                            padding: "10px",
                            marginTop: "6px",
                            borderRadius: "6px",
                            border: "1px solid #c9cccf",
                          }}
                        >
                          <option value="NORMAL">Normal</option>
                          <option value="FLUGEL">Flügel</option>
                        </select>
                      </div>

                      {/* ============================================
                          FLUGEL FIELDS — NEW: + DEPENDENCY DROPDOWN
                      ============================================ */}
                      {stepFormData.measurementMode === "FLUGEL" && (
                        <>
                          {/* Flügel Min / Max */}
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "1fr 1fr",
                              gap: "16px",
                              marginTop: "16px",
                            }}
                          >
                            <div>
                              <label>
                                <s-text variant="bodySm"><strong>Flügel Minimum (mm)</strong></s-text>
                              </label>
                              <input
                                type="number"
                                value={stepFormData.flugelMin}
                                onChange={(e) => setStepFormData({ ...stepFormData, flugelMin: e.target.value })}
                                placeholder="e.g., 1"
                                style={inputStyle}
                              />
                            </div>

                            <div>
                              <label>
                                <s-text variant="bodySm"><strong>Flügel Maximum (mm)</strong></s-text>
                              </label>
                              <input
                                type="number"
                                value={stepFormData.flugelMax}
                                onChange={(e) => setStepFormData({ ...stepFormData, flugelMax: e.target.value })}
                                placeholder="e.g., 4"
                                style={inputStyle}
                              />
                            </div>
                          </div>

                          {/* NEW: Dependency Option Dropdown */}
                          <div
                            style={{
                              marginTop: "20px",
                              padding: "16px",
                              background: "#fff8e1",
                              borderRadius: "8px",
                              border: "1px solid #f0c14b",
                            }}
                          >
                            <s-text variant="bodyMd">
                              <strong>🔗 Flügel Dependency (Abhängigkeit)</strong>
                            </s-text>
                            <div style={{ marginTop: "4px" }}>
                              <s-text variant="bodySm" tone="subdued">
                                Wählen Sie eine Option aus einem anderen Schritt. Nur wenn der Kunde
                                diese Option wählt, wird das Flügel-Maßfeld angezeigt.
                                Alle anderen Optionen zeigen nur Breite + Höhe.
                              </s-text>
                            </div>

                            {allProductOptions.length === 0 ? (
                              <div
                                style={{
                                  marginTop: "10px",
                                  padding: "10px",
                                  background: "#f9fafb",
                                  borderRadius: "6px",
                                  border: "1px dashed #c9cccf",
                                }}
                              >
                                <s-text variant="bodySm" tone="subdued">
                                  ⚠️ Noch keine Optionen in anderen Schritten vorhanden.
                                  Bitte zuerst andere Schritte mit Optionen anlegen,
                                  dann hier die Abhängigkeit setzen.
                                </s-text>
                              </div>
                            ) : (
                              <select
                                value={stepFormData.flugelDependencyOptionId || ""}
                                onChange={(e) =>
                                  setStepFormData({
                                    ...stepFormData,
                                    flugelDependencyOptionId: e.target.value,
                                  })
                                }
                                style={{
                                  width: "95%",
                                  padding: "10px",
                                  marginTop: "10px",
                                  borderRadius: "6px",
                                  border: "1px solid #c9cccf",
                                  fontSize: "14px",
                                  backgroundColor: "#fff",
                                }}
                              >
                                <option value="">
                                  -- Keine Dependency (Flügel immer anzeigen) --
                                </option>
                                {allProductOptions.map((opt) => (
                                  <option key={opt.id} value={opt.id}>
                                    [{opt.stepTitle}] → {opt.label}
                                  </option>
                                ))}
                              </select>
                            )}

                            {/* Show currently selected dependency info */}
                            {stepFormData.flugelDependencyOptionId && (
                              <div
                                style={{
                                  marginTop: "10px",
                                  padding: "8px 12px",
                                  background: "#e6f4ea",
                                  borderRadius: "6px",
                                  border: "1px solid #a8d5b5",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "8px",
                                }}
                              >
                                <span>✅</span>
                                <s-text variant="bodySm">
                                  <strong>Flügel wird angezeigt wenn: </strong>
                                  {(() => {
                                    const found = allProductOptions.find(
                                      (o) => o.id === stepFormData.flugelDependencyOptionId
                                    );
                                    return found
                                      ? `"${found.label}" (aus Schritt: ${found.stepTitle})`
                                      : "Ausgewählte Option";
                                  })()}
                                </s-text>
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  <s-divider />

                  {/* Action Buttons */}
                  <s-stack direction="inline" gap="base">
                    <s-button
                      variant="primary"
                      onClick={handleSaveStep}
                      {...(isLoading ? { loading: true } : {})}
                      disabled={!stepFormData.key || !stepFormData.title}
                    >
                      {editingStep ? "💾 Schritt aktualisieren" : "✓ Schritt erstellen"}
                    </s-button>
                    <s-button
                      variant="tertiary"
                      onClick={() => {
                        setShowStepForm(false);
                        setEditingStep(null);
                      }}
                    >
                      Abbrechen
                    </s-button>
                  </s-stack>
                </s-stack>
              </s-box>
            </div>
          )}

          {/* Existing Steps List */}
          {product.steps.length === 0 && !showStepForm ? (
            <s-box
              padding="loose"
              borderWidth="base"
              borderRadius="base"
              style={{ textAlign: "center", padding: "48px" }}
            >
              <div style={{ fontSize: "48px", marginBottom: "16px" }}>📋</div>
              <s-heading variant="headingMd">
                Noch keine Konfigurationsschritte vorhanden{" "}
              </s-heading>
              <s-text tone="subdued">
                Beginnen Sie, indem Sie oben Ihren ersten Konfigurationsschritt erstellen{" "}
              </s-text>
            </s-box>
          ) : (
            <DndContext onDragEnd={handleStepDragEnd}>
              <SortableContext items={product.steps.map((s) => s.id)}>
                {product.steps.map((step, index) => (
                  <SortableItem key={step.id} id={step.id}>
                    <s-box
                      key={step.id}
                      padding="loose"
                      borderWidth="base"
                      borderRadius="base"
                      background="surface"
                    >
                      <s-stack direction="block" gap="base">
                        {/* Step Header */}
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            padding: "12px",
                            flexDirection: "column",
                            gap: "10px",
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "12px",
                                marginBottom: "8px",
                              }}
                            >
                              <s-badge tone="info">Step {step.order}</s-badge>
                              <div
                                variant="headingMd"
                                style={{
                                  display: "inline-block",
                                  maxWidth: "340px",
                                  wordBreak: "break-all",
                                }}
                              >
                                {step.title}
                              </div>
                              <s-badge
                                tone={
                                  step.type === "OPTIONS"
                                    ? "success"
                                    : step.type === "DROPDOWN"
                                    ? "info"
                                    : "attention"
                                }
                              >
                                {step.type === "OPTIONS"
                                  ? "📋 Multiple Choice"
                                  : step.type === "DROPDOWN"
                                  ? "🔽 Dropdown"
                                  : "📏 Measurements"}
                              </s-badge>
                            </div>
                            {step.subtitle && (
                              <s-text tone="subdued">{step.subtitle}</s-text>
                            )}
                          </div>
                          <s-stack direction="inline" gap="tight">
                            <s-button
                              variant="secondary"
                              onClick={() => handleEditStep(step)}
                            >
                              ✏️ Bearbeiten
                            </s-button>
                            <s-button
                              variant="tertiary"
                              tone="critical"
                              onClick={() => handleDeleteStep(step.id)}
                            >
                              🗑️ Löschen
                            </s-button>
                          </s-stack>
                        </div>

                        <s-divider />

                        {/* Step Details */}
                        <div
                          style={{
                            background: "#f9fafb",
                            padding: "12px",
                            borderRadius: "6px",
                          }}
                        >
                          <s-stack direction="inline" gap="loose">
                            <div>
                              <s-text variant="bodySm" tone="subdued">
                                Interner Schlüssel{" "}
                              </s-text>
                              <s-text
                                variant="bodyMd"
                                style={{ fontFamily: "monospace", fontSize: "13px" }}
                              >
                                {step.key}{" "}
                              </s-text>
                            </div>
                            {step.description && (
                              <div style={{ flex: 1 }}>
                                <s-text variant="bodySm" tone="subdued">
                                  Beschreibung{" "}
                                </s-text>
                                <s-text variant="bodyMd">{step.description}</s-text>
                              </div>
                            )}
                          </s-stack>
                        </div>

                        {/* Step Image */}
                        {step.image && (
                          <div
                            style={{
                              marginBottom: "8px",
                              display: "block",
                              marginLeft: "12px",
                            }}
                          >
                            <s-text
                              variant="bodySm"
                              tone="subdued"
                              style={{ marginBottom: "8px", display: "block" }}
                            >
                              Bild des Schritts
                            </s-text>
                            <s-box>
                              <img
                                src={step.image}
                                alt={step.title}
                                style={{
                                  maxWidth: "300px",
                                  maxHeight: "200px",
                                  borderRadius: "6px",
                                  border: "1px solid #e1e3e5",
                                }}
                              />
                            </s-box>
                          </div>
                        )}

                        {/* Measurement Ranges Display — NEW: shows flugel dependency info */}
                        {step.type === "MEASUREMENT" && (
                          <div
                            style={{
                              background: "#fef3c7",
                              padding: "16px",
                              borderRadius: "6px",
                            }}
                          >
                            <s-text variant="bodyMd">
                              <strong>📏 Messbereiche</strong>
                            </s-text>
                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns: "1fr 1fr",
                                gap: "16px",
                                marginTop: "12px",
                              }}
                            >
                              <div>
                                <s-text variant="bodySm" tone="subdued">Breite - Bereich</s-text>
                                <s-text variant="bodyMd">
                                  <strong>{step.widthMin} mm - {step.widthMax} mm</strong>
                                </s-text>
                              </div>
                              <div>
                                <s-text variant="bodySm" tone="subdued">Höhe - Bereich</s-text>
                                <s-text variant="bodyMd">
                                  <strong>{step.heightMin} mm - {step.heightMax} mm</strong>
                                </s-text>
                              </div>
                              {/* NEW: show flugel info if FLUGEL mode */}
                              {step.measurementMode === "FLUGEL" && (
                                <>
                                  <div>
                                    <s-text variant="bodySm" tone="subdued">Flügel - Bereich</s-text>
                                    <s-text variant="bodyMd">
                                      <strong>{step.flugelMin} mm - {step.flugelMax} mm</strong>
                                    </s-text>
                                  </div>
                                  <div>
                                    <s-text variant="bodySm" tone="subdued">Flügel Dependency</s-text>
                                    <s-text variant="bodyMd">
                                      {step.flugelDependencyOptionId ? (
                                        (() => {
                                          const depOpt = allProductOptions.find(
                                            (o) => o.id === step.flugelDependencyOptionId
                                          );
                                          return depOpt ? (
                                            <s-badge tone="warning">
                                              {depOpt.label} ({depOpt.stepTitle})
                                            </s-badge>
                                          ) : (
                                            <s-badge tone="critical">Option nicht gefunden</s-badge>
                                          );
                                        })()
                                      ) : (
                                        <s-badge tone="info">Immer anzeigen</s-badge>
                                      )}
                                    </s-text>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Options Section */}
                        {(step.type === "OPTIONS" || step.type === "DROPDOWN") && (
                          <>
                            <s-divider />
                            <div style={{ margin: "10px" }}>
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  marginBottom: "12px",
                                  padding: "12px",
                                }}
                              >
                                <s-heading variant="headingSm">
                                  Kundenauswahl ({step.options.length})
                                </s-heading>
                                <s-button
                                  variant="secondary"
                                  size="slim"
                                  onClick={() => {
                                    setShowOptionForm(step.id);
                                    setEditingOption(null);
                                    setOptionFormData({
                                      value: "",
                                      label: "",
                                      description: "",
                                      image: "",
                                      price: "0",
                                      showSteps: "",
                                    });

                                    setTimeout(() => {
                                      optionFormRefs.current[step.id]?.scrollIntoView({
                                        behavior: "smooth",
                                        block: "center",
                                        inline: "nearest",
                                      });
                                    }, 100);
                                  }}
                                >
                                  + Auswahl hinzufügen
                                </s-button>
                              </div>

                              {step.options.length === 0 ? (
                                <div
                                  style={{
                                    background: "#f9fafb",
                                    padding: "32px",
                                    borderRadius: "6px",
                                    textAlign: "center",
                                    border: "2px dashed #e1e3e5",
                                  }}
                                >
                                  <div style={{ fontSize: "32px", marginBottom: "8px" }}>🎯</div>
                                  <s-text tone="subdued">
                                    Noch keine Auswahl hinzugefügt. Optionen für Kunden hinzufügen.
                                  </s-text>
                                </div>
                              ) : (
                                <s-stack direction="block" gap="tight">
                                  <DndContext onDragEnd={(e) => handleOptionDragEnd(e, step)}>
                                    <SortableContext items={step.options.map((o) => o.id)}>
                                      {step.options.map((option) => (
                                        <SortableItem key={option.id} id={option.id}>
                                          <div
                                            className="sjdfjsdfdh"
                                            key={option.id}
                                            style={{
                                              marginBottom: "10px",
                                              padding: "16px",
                                              background: "white",
                                              borderRadius: "6px",
                                              border: "1px solid #e1e3e5",
                                            }}
                                          >
                                            <div style={{ display: "flex", gap: "16px" }}>
                                              {option.image && (
                                                <div style={{ flexShrink: 0 }}>
                                                  <img
                                                    src={option.image}
                                                    alt={option.label}
                                                    style={{
                                                      width: "80px",
                                                      height: "80px",
                                                      objectFit: "cover",
                                                      borderRadius: "6px",
                                                      border: "1px solid #e1e3e5",
                                                    }}
                                                  />
                                                </div>
                                              )}

                                              <div style={{ flex: 1 }}>
                                                <div
                                                  style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: "8px",
                                                    marginBottom: "6px",
                                                    justifyContent: "space-between",
                                                  }}
                                                >
                                                  <div
                                                    className="price-text"
                                                    style={{ display: "flex", gap: "6px" }}
                                                  >
                                                    <s-text variant="bodyMd">
                                                      <strong>{option.label}</strong>
                                                    </s-text>
                                                    {option.price > 0 && (
                                                      <s-badge tone="success">
                                                        +€{option.price.toFixed(2)}
                                                      </s-badge>
                                                    )}
                                                  </div>
                                                  <div style={{ display: "flex", gap: "6px" }}>
                                                    <s-button
                                                      variant="secondary"
                                                      size="slim"
                                                      onClick={() => {
                                                        setShowOptionForm(step.id);
                                                        handleEditOption(option, step.id);
                                                      }}
                                                    >
                                                      Bearbeiten
                                                    </s-button>
                                                    <s-button
                                                      variant="tertiary"
                                                      tone="critical"
                                                      size="slim"
                                                      onClick={() => handleDeleteOption(option.id)}
                                                    >
                                                      Löschen
                                                    </s-button>
                                                  </div>
                                                </div>

                                                <s-text
                                                  variant="bodySm"
                                                  tone="subdued"
                                                  style={{
                                                    fontFamily: "monospace",
                                                    fontSize: "12px",
                                                    display: "block",
                                                    marginBottom: "6px",
                                                  }}
                                                >
                                                  Value: {option.value}
                                                </s-text>

                                                {option.sku && (
                                                  <s-text
                                                    variant="bodySm"
                                                    tone="subdued"
                                                    style={{
                                                      fontFamily: "monospace",
                                                      fontSize: "12px",
                                                      display: "block",
                                                      marginBottom: "6px",
                                                    }}
                                                  >
                                                    SKU: {option.sku}
                                                  </s-text>
                                                )}
                                                {option.description && (
                                                  <s-text
                                                    variant="bodySm"
                                                    style={{ display: "block", marginBottom: "6px" }}
                                                  >
                                                    {option.description}
                                                  </s-text>
                                                )}

                                                {option.showSteps && (
                                                  <div
                                                    style={{
                                                      padding: "8px 12px",
                                                      borderRadius: "4px",
                                                      marginTop: "8px",
                                                    }}
                                                  >
                                                    {option.showSteps &&
                                                      (() => {
                                                        let steps = [];
                                                        try {
                                                          steps = JSON.parse(option.showSteps);
                                                        } catch (e) {
                                                          return null;
                                                        }
                                                        return (
                                                          <div>
                                                            <s-text variant="bodySm">
                                                              <strong>Nächste Schritte:</strong>
                                                            </s-text>
                                                            <ul style={{ marginTop: "6px", paddingLeft: "18px" }}>
                                                              {steps.map((step, index) => (
                                                                <li key={index}>
                                                                  <s-text variant="bodySm">{step}</s-text>
                                                                </li>
                                                              ))}
                                                            </ul>
                                                          </div>
                                                        );
                                                      })()}
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                        </SortableItem>
                                      ))}
                                    </SortableContext>
                                  </DndContext>
                                </s-stack>
                              )}

                              {/* Option Form */}
                              {showOptionForm === step.id && (
                                <div
                                  ref={(el) => (optionFormRefs.current[step.id] = el)}
                                  style={{ scrollMarginTop: "20px" }}
                                >
                                  <s-box
                                    padding="base"
                                    background="surface-subdued"
                                    borderRadius="base"
                                    style={{
                                      marginTop: "16px",
                                      boxShadow: editingOption
                                        ? "0 0 0 3px rgba(0, 128, 96, 0.3)"
                                        : "none",
                                      transition: "box-shadow 0.3s ease",
                                    }}
                                  >
                                    <s-stack direction="block" gap="base">
                                      <div
                                        style={{
                                          display: "flex",
                                          justifyContent: "space-between",
                                          alignItems: "center",
                                        }}
                                      >
                                        <s-heading variant="headingSm">
                                          {editingOption
                                            ? "✏️ Auswahl bearbeiten"
                                            : "➕ Neue Auswahl hinzufügen"}
                                        </s-heading>
                                        <s-badge tone={editingOption ? "warning" : "info"}>
                                          {editingOption ? "Bearbeiten" : "Neu"}
                                        </s-badge>
                                      </div>

                                      <s-divider />

                                      <div>
                                        <label style={{ display: "block", marginBottom: "4px" }}>
                                          <s-text variant="bodySm">
                                            <strong>Auswahlbezeichnung </strong>{" "}
                                            <span style={{ color: "#bf0711" }}>*</span>
                                          </s-text>
                                        </label>
                                        <s-text variant="bodySm" tone="subdued">
                                          Was Kunden sehen (e.g., "Standardfenster"){" "}
                                        </s-text>
                                        <input
                                          type="text"
                                          value={optionFormData.label}
                                          onChange={(e) =>
                                            setOptionFormData({ ...optionFormData, label: e.target.value })
                                          }
                                          placeholder="e.g., Standard Window"
                                          required
                                          style={{
                                            width: "95%",
                                            padding: "10px 12px",
                                            border: "1px solid #c9cccf",
                                            borderRadius: "6px",
                                            marginTop: "6px",
                                            fontSize: "14px",
                                          }}
                                        />
                                      </div>

                                      <div>
                                        <label style={{ display: "block", marginBottom: "4px" }}>
                                          <s-text variant="bodySm">
                                            <strong>Interner Wert </strong>{" "}
                                            <span style={{ color: "#bf0711" }}>*</span>
                                          </s-text>
                                        </label>
                                        <s-text variant="bodySm" tone="subdued">
                                          Eindeutiger Code für diese Auswahl (klein, keine Leerzeichen)
                                        </s-text>
                                        <input
                                          type="text"
                                          value={optionFormData.value}
                                          onChange={(e) =>
                                            setOptionFormData({
                                              ...optionFormData,
                                              value: e.target.value.toLowerCase().replace(/\s/g, "_"),
                                            })
                                          }
                                          placeholder="e.g., standard_window"
                                          required
                                          style={{
                                            width: "95%",
                                            padding: "10px 12px",
                                            border: "1px solid #c9cccf",
                                            borderRadius: "6px",
                                            marginTop: "6px",
                                            fontSize: "14px",
                                            fontFamily: "monospace",
                                          }}
                                        />
                                      </div>

                                      <div>
                                        <label style={{ display: "block", marginBottom: "4px" }}>
                                          <s-text variant="bodySm"><strong>SKU</strong> (Optional)</s-text>
                                        </label>
                                        <s-text variant="bodySm" tone="subdued">
                                          Artikelnummer für diese Auswahl
                                        </s-text>
                                        <input
                                          type="text"
                                          value={optionFormData.sku}
                                          onChange={(e) =>
                                            setOptionFormData({ ...optionFormData, sku: e.target.value })
                                          }
                                          placeholder="e.g., SKU-12345"
                                          style={{
                                            width: "95%",
                                            padding: "10px 12px",
                                            border: "1px solid #c9cccf",
                                            borderRadius: "6px",
                                            marginTop: "6px",
                                            fontSize: "14px",
                                            fontFamily: "monospace",
                                          }}
                                        />
                                      </div>

                                      {step.type === "DROPDOWN" && product.steps.filter((s) => s.type === "DROPDOWN" && s.order < step.order).length > 0  && (
                                        <div>
                                          <label>
                                            <s-text variant="bodySm">
                                              <strong>Parent Option (Dependency)</strong>
                                            </s-text>
                                          </label>
                                          <select
                                            multiple
                                            value={optionFormData.parentOptionIds || []}
                                            onChange={(e) => {
                                              const selected = Array.from(
                                                e.target.selectedOptions,
                                                (o) => o.value,
                                              );
                                              setOptionFormData({ ...optionFormData, parentOptionIds: selected });
                                            }}
                                          >
                                            {product.steps
                                              .filter((s) => s.order < step.order)
                                              .flatMap((s) => s.options)
                                              .map((opt) => (
                                                <option key={opt.id} value={opt.id}>
                                                  {opt.label}
                                                </option>
                                              ))}
                                          </select>
                                        </div>
                                      )}

                                      <div>
                                        <label style={{ display: "block", marginBottom: "4px" }}>
                                          <s-text variant="bodySm">
                                            <strong>Beschreibung</strong> (Optional)
                                          </s-text>
                                        </label>
                                        <s-text variant="bodySm" tone="subdued">
                                          Zusätzliche Details, um Kunden bei der Entscheidung zu helfen
                                        </s-text>
                                        <div style={{ marginTop: "6px", width: "95%" }}>
                                          {isClient && ReactQuill && (
                                            <ReactQuill
                                              value={optionFormData.description || ""}
                                              onChange={(value) =>
                                                setOptionFormData({ ...optionFormData, description: value })
                                              }
                                              placeholder="e.g., Perfekt für rechteckige Fenster"
                                              modules={modules}
                                              style={{ background: "#fff", borderRadius: "6px" }}
                                            />
                                          )}
                                        </div>
                                      </div>

                                      <div>
                                        <label style={{ display: "block", marginBottom: "4px" }}>
                                          <s-text variant="bodySm">
                                            <strong>💰 Zusätzliche Kosten</strong>
                                          </s-text>
                                        </label>
                                        <s-text variant="bodySm" tone="subdued">
                                          Extra Kosten für diese Auswahl (lassen Sie 0 für keine zusätzlichen Kosten)
                                        </s-text>
                                        <div style={{ position: "relative", marginTop: "6px" }}>
                                          <span
                                            style={{
                                              position: "absolute",
                                              left: "12px",
                                              top: "50%",
                                              transform: "translateY(-50%)",
                                              fontSize: "14px",
                                              color: "#6b7280",
                                            }}
                                          >
                                            €
                                          </span>
                                          <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={optionFormData.price}
                                            onChange={(e) =>
                                              setOptionFormData({ ...optionFormData, price: e.target.value })
                                            }
                                            placeholder="0.00"
                                            style={{
                                              width: "95%",
                                              padding: "10px 12px 10px 28px",
                                              border: "1px solid #c9cccf",
                                              borderRadius: "6px",
                                              fontSize: "14px",
                                            }}
                                          />
                                        </div>
                                      </div>

                                      <div>
                                        <label style={{ display: "block", marginBottom: "4px" }}>
                                          <s-text variant="bodySm">
                                            <strong>🖼️ Auswahlbild</strong> (Optional)
                                          </s-text>
                                        </label>
                                        <s-text variant="bodySm" tone="subdued">
                                          Visuelle Darstellung dieser Auswahl
                                        </s-text>
                                        <input
                                          type="file"
                                          accept="image/*"
                                          onChange={handleOptionImageUpload}
                                          disabled={uploadingOptionImage}
                                          style={{
                                            width: "95%",
                                            padding: "10px 12px",
                                            border: "2px dashed #c9cccf",
                                            borderRadius: "6px",
                                            marginTop: "6px",
                                            backgroundColor: "#fff",
                                            cursor: "pointer",
                                          }}
                                        />
                                        {uploadingOptionImage && (
                                          <div
                                            style={{
                                              marginTop: "8px",
                                              display: "flex",
                                              alignItems: "center",
                                              gap: "8px",
                                            }}
                                          >
                                            <s-spinner size="small" />
                                            <s-text variant="bodySm">Bild wird hochgeladen...</s-text>
                                          </div>
                                        )}
                                        {optionFormData.image && (
                                          <div
                                            style={{
                                              marginTop: "12px",
                                              position: "relative",
                                              display: "inline-block",
                                            }}
                                          >
                                            <img
                                              src={optionFormData.image}
                                              alt="Preview"
                                              style={{
                                                maxWidth: "200px",
                                                maxHeight: "150px",
                                                borderRadius: "6px",
                                                border: "1px solid #e1e3e5",
                                              }}
                                            />
                                            <button
                                              onClick={() =>
                                                setOptionFormData({ ...optionFormData, image: "" })
                                              }
                                              style={{
                                                position: "absolute",
                                                top: "8px",
                                                right: "8px",
                                                background: "rgba(0,0,0,0.7)",
                                                color: "white",
                                                border: "none",
                                                borderRadius: "50%",
                                                width: "24px",
                                                height: "24px",
                                                cursor: "pointer",
                                                fontSize: "14px",
                                              }}
                                            >
                                              ✕
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                      {index === 0 && (
                                        <div>
                                          <label style={{ display: "block", marginBottom: "4px" }}>
                                            <s-text variant="bodySm">
                                              <strong>🔀 Bedingter Fluss</strong> (Fortgeschritten)
                                            </s-text>
                                        </label>
                                        <s-text variant="bodySm" tone="subdued">
                                          Zeige spezifische nächste Schritte, wenn diese Wahl ausgewählt wird
                                        </s-text>
                                        <s-text
                                          variant="bodySm"
                                          tone="subdued"
                                          style={{ display: "block", marginTop: "4px", fontStyle: "italic" }}
                                        >
                                          Format: ["step_key_1", "step_key_2"] oder leer lassen, um alle Schritte zu zeigen
                                        </s-text>
                                        <input
                                          type="text"
                                          value={optionFormData.showSteps}
                                          onChange={(e) =>
                                            setOptionFormData({ ...optionFormData, showSteps: e.target.value })
                                          }
                                          placeholder='e.g., ["color_selection", "measurements"]'
                                          style={{
                                            width: "95%",
                                            padding: "10px 12px",
                                            border: "1px solid #c9cccf",
                                            borderRadius: "6px",
                                            marginTop: "6px",
                                            fontSize: "14px",
                                            fontFamily: "monospace",
                                          }}
                                        />
                                      </div>
                                      )}
                                      <s-divider />

                                      <s-stack direction="inline" gap="base">
                                        <s-button
                                          variant="primary"
                                          onClick={() => handleSaveOption(step.id)}
                                          {...(isLoading ? { loading: true } : {})}
                                          disabled={!optionFormData.value || !optionFormData.label}
                                        >
                                          {editingOption ? "💾 Aktualisieren" : "✓ Speichern"}
                                        </s-button>
                                        <s-button
                                          variant="tertiary"
                                          onClick={() => {
                                            setShowOptionForm(null);
                                            setEditingOption(null);
                                          }}
                                        >
                                          Abbrechen
                                        </s-button>
                                      </s-stack>
                                    </s-stack>
                                  </s-box>
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </s-stack>
                    </s-box>
                  </SortableItem>
                ))}
              </SortableContext>
            </DndContext>
          )}
        </s-stack>
      </s-section>

      {/* Help Section */}
      <s-section slot="aside">
        <s-box padding="base" borderWidth="base" borderRadius="base" background="surface">
          <s-stack direction="block" gap="base">
            <s-heading variant="headingSm">💡 Tipps</s-heading>
            <s-divider />
            <s-stack direction="block" gap="tight">
              <div>
                <s-text variant="bodySm"><strong>✓ Schrittarten:</strong></s-text>
                <s-text variant="bodySm" tone="subdued">
                  Verwenden Sie "Multiple Choice" für vorgegebene Optionen, "Measurements" für benutzerdefinierte Dimensionen
                </s-text>
              </div>
              <div>
                <s-text variant="bodySm"><strong>✓ Bilder:</strong></s-text>
                <s-text variant="bodySm" tone="subdued">
                  Fügen Sie Bilder hinzu, um Kunden bei der Visualisierung ihrer Auswahl zu helfen
                </s-text>
              </div>
              <div>
                <s-text variant="bodySm"><strong>✓ Pricing:</strong></s-text>
                <s-text variant="bodySm" tone="subdued">
                  Setzen Sie zusätzliche Kosten für Premium-Optionen
                </s-text>
              </div>
              <div>
                <s-text variant="bodySm"><strong>✓ Flow Control:</strong></s-text>
                <s-text variant="bodySm" tone="subdued">
                  Verwenden Sie bedingte Schritte, um dynamische Konfigurationspfade zu erstellen
                </s-text>
              </div>
            </s-stack>
          </s-stack>
        </s-box>

        <s-box
          padding="base"
          borderWidth="base"
          borderRadius="base"
          background="surface"
          style={{ marginTop: "16px" }}
        >
          <s-stack direction="block" gap="tight">
            <s-heading variant="headingSm">📚 Tipps</s-heading>
            <s-divider />
            <s-unordered-list>
              <s-list-item>Schrittüberschriften sind klar und prägnant</s-list-item>
              <s-list-item>Verwenden Sie für alle Optionen beschreibende Etiketten</s-list-item>
              <s-list-item>Testen Sie den Fluss von der Perspektive des Kunden</s-list-item>
              <s-list-item>Fügen Sie Bilder hinzu, wenn möglich</s-list-item>
            </s-unordered-list>
          </s-stack>
        </s-box>
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};