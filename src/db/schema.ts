import {
  pgTable,
  text,
  timestamp,
  boolean,
  pgEnum,
  uuid,
  bigserial,
  bigint,
  integer,
  jsonb,
  index,
  date,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const userRoleEnum = pgEnum("user_role", ["worker", "manager"]);
export const movementKindEnum = pgEnum("movement_kind", [
  "inbound",
  "outbound",
  "adjustment",
]);
export const sourceFormKindEnum = pgEnum("source_form_kind", [
  "inbound",
  "outbound",
]);
export const formStatusEnum = pgEnum("form_status", [
  "pending",
  "approved",
  "rejected",
]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  name: text("name").notNull(),
  role: userRoleEnum("role").notNull().default("worker"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdateFn(() => new Date()),
});

export const auditLog = pgTable("audit_log", {
  id: bigserial("id", { mode: "bigint" }).primaryKey(),
  actorUserId: uuid("actor_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id"),
  payload: jsonb("payload").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const stockMovements = pgTable(
  "stock_movements",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    kind: movementKindEnum("kind").notNull(),
    boxesDelta: integer("boxes_delta").notNull(),
    reason: text("reason"),
    sourceFormKind: sourceFormKindEnum("source_form_kind"),
    sourceFormId: bigint("source_form_id", { mode: "bigint" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    createdAtIdx: index("stock_movements_created_at_idx").on(t.createdAt),
    sourceIdx: index("stock_movements_source_idx").on(
      t.sourceFormKind,
      t.sourceFormId,
    ),
    productIdx: index("stock_movements_product_id_idx").on(t.productId),
  }),
);

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (t) => ({
    activeNameIdx: index("products_active_name_idx").on(
      t.isActive,
      sql`lower(${t.name})`,
    ),
  }),
);

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    phone: text("phone"),
    location: text("location"),
    notes: text("notes"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (t) => ({
    activeNameIdx: index("customers_active_name_idx").on(
      t.isActive,
      sql`lower(${t.name})`,
    ),
  }),
);

export const suppliers = pgTable(
  "suppliers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    country: text("country"),
    contact: text("contact"),
    notes: text("notes"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (t) => ({
    activeNameIdx: index("suppliers_active_name_idx").on(
      t.isActive,
      sql`lower(${t.name})`,
    ),
  }),
);

export const inboundForms = pgTable(
  "inbound_forms",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "restrict" }),
    boxes: integer("boxes").notNull(),
    receivedDate: date("received_date").notNull(),
    note: text("note"),
    attachmentKey: text("attachment_key"),
    status: formStatusEnum("status").notNull().default("pending"),
    decisionReason: text("decision_reason"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    decidedBy: uuid("decided_by").references(() => users.id, {
      onDelete: "set null",
    }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (t) => ({
    statusCreatedAtIdx: index("inbound_forms_status_created_at_idx").on(
      t.status,
      t.createdAt,
    ),
    createdByIdx: index("inbound_forms_created_by_idx").on(t.createdBy),
    boxesPositive: check(
      "inbound_forms_boxes_positive",
      sql`${t.boxes} > 0`,
    ),
  }),
);

export const inboundFormLines = pgTable(
  "inbound_form_lines",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    formId: bigint("form_id", { mode: "bigint" })
      .notNull()
      .references(() => inboundForms.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    boxes: integer("boxes").notNull(),
  },
  (t) => ({
    formIdIdx: index("inbound_form_lines_form_id_idx").on(t.formId),
    boxesPositive: check(
      "inbound_form_lines_boxes_positive",
      sql`${t.boxes} > 0`,
    ),
  }),
);

export const outboundForms = pgTable(
  "outbound_forms",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    boxes: integer("boxes").notNull(),
    /** Money is stored as integer pesewas. 1 GHS = 100 pesewas. */
    unitPricePesewas: integer("unit_price_pesewas").notNull(),
    /** Stored generated column = boxes * unit_price_pesewas. Always in sync. */
    totalPesewas: integer("total_pesewas").generatedAlwaysAs(
      sql`(boxes * unit_price_pesewas)`,
    ),
    dispatchDate: date("dispatch_date").notNull(),
    note: text("note"),
    status: formStatusEnum("status").notNull().default("pending"),
    decisionReason: text("decision_reason"),
    invoiceNumber: bigint("invoice_number", { mode: "bigint" }).unique(),
    invoicePdfKey: text("invoice_pdf_key"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    decidedBy: uuid("decided_by").references(() => users.id, {
      onDelete: "set null",
    }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (t) => ({
    statusCreatedAtIdx: index("outbound_forms_status_created_at_idx").on(
      t.status,
      t.createdAt,
    ),
    createdByIdx: index("outbound_forms_created_by_idx").on(t.createdBy),
    boxesPositive: check(
      "outbound_forms_boxes_positive",
      sql`${t.boxes} > 0`,
    ),
    unitPricePositive: check(
      "outbound_forms_unit_price_positive",
      sql`${t.unitPricePesewas} > 0`,
    ),
  }),
);

export type UserRole = (typeof userRoleEnum.enumValues)[number];
export type MovementKind = (typeof movementKindEnum.enumValues)[number];
export type SourceFormKind = (typeof sourceFormKindEnum.enumValues)[number];
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type AuditLogEntry = typeof auditLog.$inferSelect;
export type NewAuditLogEntry = typeof auditLog.$inferInsert;
export type StockMovement = typeof stockMovements.$inferSelect;
export type NewStockMovement = typeof stockMovements.$inferInsert;
export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
export type Supplier = typeof suppliers.$inferSelect;
export type NewSupplier = typeof suppliers.$inferInsert;
export type FormStatus = (typeof formStatusEnum.enumValues)[number];
export type InboundForm = typeof inboundForms.$inferSelect;
export type NewInboundForm = typeof inboundForms.$inferInsert;
export type InboundFormLine = typeof inboundFormLines.$inferSelect;
export type NewInboundFormLine = typeof inboundFormLines.$inferInsert;
export type OutboundForm = typeof outboundForms.$inferSelect;
export type NewOutboundForm = typeof outboundForms.$inferInsert;
