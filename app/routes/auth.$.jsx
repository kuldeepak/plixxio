// import { boundary } from "@shopify/shopify-app-react-router/server";
// import { authenticate } from "../shopify.server";

// export const loader = async ({ request }) => {
//   await authenticate.admin(request);

//    await registerWebhooks({ session });

//   return null;
// };

// export const headers = (headersArgs) => {
//   return boundary.headers(headersArgs);
// };
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate, registerWebhooks } from "../shopify.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);

  // 🔥 REQUIRED: registers webhook for this shop
  await registerWebhooks({ session });

  return null;
};

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};