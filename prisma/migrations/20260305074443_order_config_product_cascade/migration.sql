-- DropForeignKey
ALTER TABLE "order_configurations" DROP CONSTRAINT "order_configurations_productId_fkey";

-- AddForeignKey
ALTER TABLE "order_configurations" ADD CONSTRAINT "order_configurations_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
