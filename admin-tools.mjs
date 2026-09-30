// Admin CLI tool — run with: node admin-tools.mjs <command> [...args]
// Every command prints what it found / did before changing anything.

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();
const [, , command, ...args] = process.argv;

async function listUsers() {
  const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
  for (const u of users) {
    console.log(`${u.role.padEnd(9)} ${u.email.padEnd(30)} ${u.fullName}  (id=${u.id})`);
  }
  console.log(`\n${users.length} user(s) total.`);
}

async function resetPassword(email, newPassword) {
  if (!email || !newPassword) return console.log('Usage: node admin-tools.mjs reset-password <email> <newPassword>');
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) return console.log(`No user found with email ${email}`);

  const hashed = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: user.id }, data: { password: hashed } });
  await prisma.session.deleteMany({ where: { userId: user.id } });
  console.log(`Password reset for ${user.fullName} (${user.email}). All their sessions were logged out.`);
}

async function makeVendor(email, businessName) {
  if (!email || !businessName) return console.log('Usage: node admin-tools.mjs make-vendor <email> "<Business Name>"');
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) return console.log(`No user found with email ${email}`);

  await prisma.user.update({ where: { id: user.id }, data: { role: 'vendor', businessName } });
  console.log(`${user.fullName} (${user.email}) is now a seller: "${businessName}"`);
}

async function deleteUser(email) {
  if (!email) return console.log('Usage: node admin-tools.mjs delete-user <email>');
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) return console.log(`No user found with email ${email}`);

  const orderCount = await prisma.order.count({ where: { userId: user.id } });
  const productCount = await prisma.product.count({ where: { vendorId: user.id } });

  if (orderCount > 0 || productCount > 0) {
    console.log(`Cannot delete ${user.email}: they have ${orderCount} order(s) and ${productCount} listing(s).`);
    console.log('Deleting them would erase real order/sales history. Leave the account as-is, or remove');
    console.log('the orders/listings first if this is genuinely test data.');
    return;
  }

  await prisma.session.deleteMany({ where: { userId: user.id } });
  await prisma.user.delete({ where: { id: user.id } });
  console.log(`Deleted user ${user.email}.`);
}

async function deleteProduct(productId) {
  if (!productId) return console.log('Usage: node admin-tools.mjs delete-product <productId>');
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return console.log(`No listing found with id ${productId}`);

  const orderItemCount = await prisma.orderItem.count({ where: { productId } });
  if (orderItemCount > 0) {
    console.log(`Cannot delete "${product.name}": it appears in ${orderItemCount} order(s).`);
    console.log('Deleting it would corrupt real order history. Set its stock to 0 instead.');
    return;
  }

  await prisma.product.delete({ where: { id: productId } });
  console.log(`Deleted listing "${product.name}" (${productId}).`);
}

async function createCoupon(code, type, value, maxUses, minOrderAmount, expiresInDays) {
  if (!code || !type || !value) {
    console.log('Usage: node admin-tools.mjs create-coupon <CODE> <percent|fixed> <value> [maxUses] [minOrderAmount] [expiresInDays]');
    console.log('  node admin-tools.mjs create-coupon WELCOME10 percent 10 100 0 30');
    console.log('  node admin-tools.mjs create-coupon SAVE2000 fixed 2000');
    return;
  }
  const discountType = type.toLowerCase() === 'percent' ? 'PERCENT' : type.toLowerCase() === 'fixed' ? 'FIXED' : null;
  if (!discountType) return console.log('Type must be "percent" or "fixed"');

  const coupon = await prisma.coupon.create({
    data: {
      code: code.trim().toUpperCase(), discountType, discountValue: parseInt(value),
      maxUses: maxUses ? parseInt(maxUses) : null,
      minOrderAmount: minOrderAmount ? parseInt(minOrderAmount) : 0,
      expiresAt: expiresInDays ? new Date(Date.now() + parseInt(expiresInDays) * 24 * 60 * 60 * 1000) : null,
    }
  });
  console.log(`Created coupon ${coupon.code}: ${discountType === 'PERCENT' ? coupon.discountValue + '%' : coupon.discountValue + ' CFA'} off.`);
}

async function listCoupons() {
  const coupons = await prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } });
  for (const c of coupons) {
    const status = !c.active ? 'INACTIVE' : (c.expiresAt && c.expiresAt < new Date()) ? 'EXPIRED' : (c.maxUses && c.usesCount >= c.maxUses) ? 'USED UP' : 'ACTIVE';
    const discount = c.discountType === 'PERCENT' ? `${c.discountValue}%` : `${c.discountValue} CFA`;
    console.log(`${c.code.padEnd(16)} ${status.padEnd(10)} ${discount.padEnd(10)} used ${c.usesCount}${c.maxUses ? `/${c.maxUses}` : ''}`);
  }
  console.log(`\n${coupons.length} coupon(s) total.`);
}

async function deactivateCoupon(code) {
  if (!code) return console.log('Usage: node admin-tools.mjs deactivate-coupon <CODE>');
  const coupon = await prisma.coupon.findUnique({ where: { code: code.trim().toUpperCase() } });
  if (!coupon) return console.log(`No coupon found with code ${code}`);

  await prisma.coupon.update({ where: { code: coupon.code }, data: { active: false } });
  console.log(`Deactivated coupon ${coupon.code}.`);
}

async function debugOrders() {
  console.log('--- SELLERS ---');
  const vendors = await prisma.user.findMany({ where: { role: 'vendor' } });
  for (const v of vendors) console.log(`id=${v.id}  "${v.fullName}"  ${v.email}  business=${v.businessName || ''}`);

  console.log('\n--- RECENT LISTINGS ---');
  const products = await prisma.product.findMany({ orderBy: { createdAt: 'desc' }, take: 20 });
  for (const p of products) console.log(`id=${p.id}  "${p.name}"  vendor="${p.vendor}"  vendorId=${p.vendorId || 'NULL'}  stock=${p.stock}`);

  console.log('\n--- RECENT ORDERS ---');
  const orders = await prisma.order.findMany({ orderBy: { createdAt: 'desc' }, take: 20, include: { items: { include: { product: true } }, user: true } });
  for (const o of orders) {
    console.log(`orderId=${o.id}  customer=${o.user?.fullName}  status=${o.status}  payment=${o.paymentStatus}  total=${o.totalAmount}`);
    for (const item of o.items) {
      console.log(`   -> "${item.product?.name}"  vendorId=${item.product?.vendorId || 'NULL'}  qty=${item.quantity}  vendorEarning=${item.vendorEarning}`);
    }
  }
}

async function main() {
  switch (command) {
    case 'list-users': return listUsers();
    case 'reset-password': return resetPassword(args[0], args[1]);
    case 'make-vendor': return makeVendor(args[0], args[1]);
    case 'delete-user': return deleteUser(args[0]);
    case 'delete-product': return deleteProduct(args[0]);
    case 'create-coupon': return createCoupon(args[0], args[1], args[2], args[3], args[4], args[5]);
    case 'list-coupons': return listCoupons();
    case 'deactivate-coupon': return deactivateCoupon(args[0]);
    case 'debug-orders': return debugOrders();
    default:
      console.log('Available commands:');
      console.log('  node admin-tools.mjs list-users');
      console.log('  node admin-tools.mjs reset-password <email> <newPassword>');
      console.log('  node admin-tools.mjs make-vendor <email> "<Business Name>"');
      console.log('  node admin-tools.mjs delete-user <email>');
      console.log('  node admin-tools.mjs delete-product <productId>');
      console.log('  node admin-tools.mjs create-coupon <CODE> <percent|fixed> <value> [maxUses] [minOrder] [expiresInDays]');
      console.log('  node admin-tools.mjs list-coupons');
      console.log('  node admin-tools.mjs deactivate-coupon <CODE>');
      console.log('  node admin-tools.mjs debug-orders    (inspect sellers/listings/orders linkage)');
  }
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
