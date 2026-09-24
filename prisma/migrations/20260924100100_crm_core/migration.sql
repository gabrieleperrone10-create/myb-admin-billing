-- CRM: tabelle, indici e FK semplici (generato con `prisma migrate diff`).
-- I vincoli multi-azienda (FK composite) e l'anti-sovrapposizione degli
-- appuntamenti sono nella migration successiva, crm_constraints_backfill.

-- Enum
CREATE TYPE "ContactLifecycle" AS ENUM ('LEAD', 'CUSTOMER', 'ARCHIVED');
CREATE TYPE "CustomFieldEntity" AS ENUM ('CONTACT', 'OPPORTUNITY');
CREATE TYPE "CustomFieldType" AS ENUM ('TEXT', 'TEXTAREA', 'NUMBER', 'DATE', 'SELECT', 'MULTISELECT', 'CHECKBOX', 'URL', 'EMAIL', 'PHONE');
CREATE TYPE "ActivityType" AS ENUM ('CONTACT_CREATED', 'CONTACT_UPDATED', 'LIFECYCLE_CHANGED', 'TAG_ADDED', 'TAG_REMOVED', 'NOTE_ADDED', 'PAGE_VIEW', 'FORM_SUBMITTED', 'EMAIL_SENT', 'EMAIL_RECEIVED', 'EMAIL_OPENED', 'EMAIL_CLICKED', 'EMAIL_BOUNCED', 'WHATSAPP_SENT', 'WHATSAPP_RECEIVED', 'APPOINTMENT_BOOKED', 'APPOINTMENT_RESCHEDULED', 'APPOINTMENT_CANCELLED', 'APPOINTMENT_COMPLETED', 'APPOINTMENT_NO_SHOW', 'OPPORTUNITY_CREATED', 'OPPORTUNITY_STAGE_CHANGED', 'OPPORTUNITY_WON', 'OPPORTUNITY_LOST', 'CLIENT_LINKED');
CREATE TYPE "MessageChannel" AS ENUM ('EMAIL', 'WHATSAPP');
CREATE TYPE "MessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');
CREATE TYPE "MessageStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'RECEIVED');
CREATE TYPE "StageKind" AS ENUM ('OPEN', 'WON', 'LOST');
CREATE TYPE "OpportunityStatus" AS ENUM ('OPEN', 'WON', 'LOST');
CREATE TYPE "AppointmentStatus" AS ENUM ('SCHEDULED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW');
CREATE TYPE "AppointmentLocation" AS ENUM ('VIDEO', 'PHONE', 'IN_PERSON', 'CUSTOM');
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'WHATSAPP');
CREATE TYPE "NotificationKind" AS ENUM ('CONFIRMATION', 'REMINDER', 'CANCELLATION', 'RESCHEDULE');

-- Colonne su tabelle esistenti
ALTER TABLE "Company" ADD COLUMN     "trackingKey" TEXT;
ALTER TABLE "Client" ADD COLUMN     "contactId" TEXT;

-- Tabelle
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "whatsapp" TEXT,
    "companyName" TEXT,
    "jobTitle" TEXT,
    "lifecycle" "ContactLifecycle" NOT NULL DEFAULT 'LEAD',
    "source" TEXT,
    "ownerUserId" TEXT,
    "attribution" JSONB,
    "customFields" JSONB NOT NULL DEFAULT '{}',
    "emailOptOut" BOOLEAN NOT NULL DEFAULT false,
    "whatsappOptOut" BOOLEAN NOT NULL DEFAULT false,
    "replyToken" TEXT NOT NULL,
    "lastActivityAt" TIMESTAMP(3),
    "lastMessageAt" TIMESTAMP(3),
    "unreadCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustomFieldDef" (
    "id" TEXT NOT NULL,
    "entity" "CustomFieldEntity" NOT NULL DEFAULT 'CONTACT',
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "CustomFieldType" NOT NULL,
    "options" JSONB,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "CustomFieldDef_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CrmTag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#4f7deb',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "CrmTag_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContactTag" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "ContactTag_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SavedView" (
    "id" TEXT NOT NULL,
    "clerkUserId" TEXT NOT NULL,
    "entity" "CustomFieldEntity" NOT NULL DEFAULT 'CONTACT',
    "name" TEXT NOT NULL,
    "filters" JSONB NOT NULL DEFAULT '{}',
    "columns" JSONB NOT NULL DEFAULT '[]',
    "sort" JSONB,
    "isShared" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "SavedView_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Note" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "opportunityId" TEXT,
    "authorUserId" TEXT,
    "body" TEXT NOT NULL,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "opportunityId" TEXT,
    "type" "ActivityType" NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "actorUserId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "channel" "MessageChannel" NOT NULL,
    "direction" "MessageDirection" NOT NULL,
    "status" "MessageStatus" NOT NULL DEFAULT 'QUEUED',
    "subject" TEXT,
    "bodyText" TEXT,
    "bodyHtml" TEXT,
    "fromAddress" TEXT,
    "toAddress" TEXT,
    "providerMessageId" TEXT,
    "inReplyTo" TEXT,
    "sentByUserId" TEXT,
    "attachments" JSONB,
    "error" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "clickedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Pipeline" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "Pipeline_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PipelineStage" (
    "id" TEXT NOT NULL,
    "pipelineId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "kind" "StageKind" NOT NULL DEFAULT 'OPEN',
    "probability" INTEGER,
    "color" TEXT NOT NULL DEFAULT '#94a3b8',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "PipelineStage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Opportunity" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "pipelineId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "status" "OpportunityStatus" NOT NULL DEFAULT 'OPEN',
    "value" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "ownerUserId" TEXT,
    "productId" TEXT,
    "contractId" TEXT,
    "source" TEXT,
    "lostReason" TEXT,
    "expectedCloseDate" TIMESTAMP(3),
    "position" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "customFields" JSONB NOT NULL DEFAULT '{}',
    "stageEnteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OpportunityStageChange" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "fromStageId" TEXT,
    "toStageId" TEXT NOT NULL,
    "changedByUserId" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "OpportunityStageChange_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Form" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fields" JSONB NOT NULL DEFAULT '[]',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "Form_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FormSubmission" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "contactId" TEXT,
    "data" JSONB NOT NULL,
    "attribution" JSONB,
    "pageUrl" TEXT,
    "visitorId" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "FormSubmission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PageView" (
    "id" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "contactId" TEXT,
    "url" TEXT NOT NULL,
    "path" TEXT,
    "title" TEXT,
    "referrer" TEXT,
    "utm" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "PageView_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Calendar" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "hostUserId" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 30,
    "slotIntervalMinutes" INTEGER NOT NULL DEFAULT 30,
    "bufferMinutes" INTEGER NOT NULL DEFAULT 0,
    "minAdvanceHours" INTEGER NOT NULL DEFAULT 2,
    "maxAdvanceDays" INTEGER NOT NULL DEFAULT 60,
    "locationType" "AppointmentLocation" NOT NULL DEFAULT 'VIDEO',
    "locationValue" TEXT,
    "color" TEXT NOT NULL DEFAULT '#4f7deb',
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Rome',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "Calendar_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Availability" (
    "id" TEXT NOT NULL,
    "calendarId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "Availability_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "calendarId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "opportunityId" TEXT,
    "hostUserId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "guestName" TEXT,
    "guestEmail" TEXT,
    "guestPhone" TEXT,
    "notes" TEXT,
    "answers" JSONB,
    "googleEventId" TEXT,
    "videoLink" TEXT,
    "manageToken" TEXT NOT NULL,
    "rescheduledCount" INTEGER NOT NULL DEFAULT 0,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserCalendarConnection" (
    "id" TEXT NOT NULL,
    "clerkUserId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'GOOGLE',
    "email" TEXT,
    "secretCipher" BYTEA NOT NULL,
    "secretIv" BYTEA NOT NULL,
    "secretTag" BYTEA NOT NULL,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastErrorAt" TIMESTAMP(3),
    "lastError" TEXT,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "UserCalendarConnection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReminderRule" (
    "id" TEXT NOT NULL,
    "offsetMinutes" INTEGER NOT NULL,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'EMAIL',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "ReminderRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "kind" "NotificationKind" NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "offsetMinutes" INTEGER NOT NULL DEFAULT 0,
    "ok" BOOLEAN NOT NULL,
    "error" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- Indici
CREATE UNIQUE INDEX "Contact_replyToken_key" ON "Contact"("replyToken");
CREATE INDEX "Contact_companyId_idx" ON "Contact"("companyId");
CREATE INDEX "Contact_companyId_lifecycle_idx" ON "Contact"("companyId", "lifecycle");
CREATE INDEX "Contact_companyId_createdAt_idx" ON "Contact"("companyId", "createdAt");
CREATE INDEX "Contact_companyId_lastActivityAt_idx" ON "Contact"("companyId", "lastActivityAt");
CREATE INDEX "Contact_companyId_lastMessageAt_idx" ON "Contact"("companyId", "lastMessageAt");
CREATE INDEX "Contact_companyId_ownerUserId_idx" ON "Contact"("companyId", "ownerUserId");
CREATE UNIQUE INDEX "Contact_companyId_email_key" ON "Contact"("companyId", "email");
CREATE UNIQUE INDEX "Contact_companyId_phone_key" ON "Contact"("companyId", "phone");
CREATE INDEX "CustomFieldDef_companyId_entity_order_idx" ON "CustomFieldDef"("companyId", "entity", "order");
CREATE UNIQUE INDEX "CustomFieldDef_companyId_entity_key_key" ON "CustomFieldDef"("companyId", "entity", "key");
CREATE INDEX "CrmTag_companyId_idx" ON "CrmTag"("companyId");
CREATE UNIQUE INDEX "CrmTag_companyId_name_key" ON "CrmTag"("companyId", "name");
CREATE INDEX "ContactTag_companyId_idx" ON "ContactTag"("companyId");
CREATE INDEX "ContactTag_tagId_idx" ON "ContactTag"("tagId");
CREATE UNIQUE INDEX "ContactTag_contactId_tagId_key" ON "ContactTag"("contactId", "tagId");
CREATE INDEX "SavedView_companyId_clerkUserId_idx" ON "SavedView"("companyId", "clerkUserId");
CREATE INDEX "Note_companyId_idx" ON "Note"("companyId");
CREATE INDEX "Note_contactId_createdAt_idx" ON "Note"("contactId", "createdAt");
CREATE INDEX "Activity_companyId_idx" ON "Activity"("companyId");
CREATE INDEX "Activity_contactId_occurredAt_idx" ON "Activity"("contactId", "occurredAt" DESC);
CREATE INDEX "Activity_companyId_type_occurredAt_idx" ON "Activity"("companyId", "type", "occurredAt");
CREATE UNIQUE INDEX "Message_providerMessageId_key" ON "Message"("providerMessageId");
CREATE INDEX "Message_companyId_idx" ON "Message"("companyId");
CREATE INDEX "Message_contactId_createdAt_idx" ON "Message"("contactId", "createdAt");
CREATE INDEX "Message_companyId_createdAt_idx" ON "Message"("companyId", "createdAt");
CREATE INDEX "Pipeline_companyId_idx" ON "Pipeline"("companyId");
CREATE INDEX "PipelineStage_companyId_idx" ON "PipelineStage"("companyId");
CREATE INDEX "PipelineStage_pipelineId_order_idx" ON "PipelineStage"("pipelineId", "order");
CREATE INDEX "Opportunity_companyId_idx" ON "Opportunity"("companyId");
CREATE INDEX "Opportunity_companyId_pipelineId_stageId_position_idx" ON "Opportunity"("companyId", "pipelineId", "stageId", "position");
CREATE INDEX "Opportunity_contactId_idx" ON "Opportunity"("contactId");
CREATE INDEX "Opportunity_companyId_status_idx" ON "Opportunity"("companyId", "status");
CREATE INDEX "OpportunityStageChange_companyId_idx" ON "OpportunityStageChange"("companyId");
CREATE INDEX "OpportunityStageChange_opportunityId_changedAt_idx" ON "OpportunityStageChange"("opportunityId", "changedAt");
CREATE INDEX "OpportunityStageChange_companyId_toStageId_changedAt_idx" ON "OpportunityStageChange"("companyId", "toStageId", "changedAt");
CREATE INDEX "Form_companyId_idx" ON "Form"("companyId");
CREATE INDEX "FormSubmission_companyId_idx" ON "FormSubmission"("companyId");
CREATE INDEX "FormSubmission_formId_createdAt_idx" ON "FormSubmission"("formId", "createdAt");
CREATE INDEX "FormSubmission_contactId_createdAt_idx" ON "FormSubmission"("contactId", "createdAt");
CREATE INDEX "PageView_companyId_visitorId_idx" ON "PageView"("companyId", "visitorId");
CREATE INDEX "PageView_companyId_occurredAt_idx" ON "PageView"("companyId", "occurredAt");
CREATE INDEX "PageView_contactId_occurredAt_idx" ON "PageView"("contactId", "occurredAt");
CREATE INDEX "Calendar_companyId_idx" ON "Calendar"("companyId");
CREATE UNIQUE INDEX "Calendar_companyId_slug_key" ON "Calendar"("companyId", "slug");
CREATE INDEX "Availability_companyId_idx" ON "Availability"("companyId");
CREATE INDEX "Availability_calendarId_dayOfWeek_idx" ON "Availability"("calendarId", "dayOfWeek");
CREATE UNIQUE INDEX "Appointment_manageToken_key" ON "Appointment"("manageToken");
CREATE INDEX "Appointment_companyId_idx" ON "Appointment"("companyId");
CREATE INDEX "Appointment_companyId_startTime_idx" ON "Appointment"("companyId", "startTime");
CREATE INDEX "Appointment_hostUserId_startTime_idx" ON "Appointment"("hostUserId", "startTime");
CREATE INDEX "Appointment_contactId_startTime_idx" ON "Appointment"("contactId", "startTime");
CREATE INDEX "UserCalendarConnection_companyId_idx" ON "UserCalendarConnection"("companyId");
CREATE UNIQUE INDEX "UserCalendarConnection_companyId_clerkUserId_provider_key" ON "UserCalendarConnection"("companyId", "clerkUserId", "provider");
CREATE INDEX "ReminderRule_companyId_idx" ON "ReminderRule"("companyId");
CREATE UNIQUE INDEX "ReminderRule_companyId_offsetMinutes_channel_key" ON "ReminderRule"("companyId", "offsetMinutes", "channel");
CREATE INDEX "NotificationLog_companyId_idx" ON "NotificationLog"("companyId");
CREATE UNIQUE INDEX "NotificationLog_appointmentId_kind_channel_offsetMinutes_key" ON "NotificationLog"("appointmentId", "kind", "channel", "offsetMinutes");
CREATE UNIQUE INDEX "Company_trackingKey_key" ON "Company"("trackingKey");
CREATE UNIQUE INDEX "Client_contactId_key" ON "Client"("contactId");

-- FK
ALTER TABLE "Client" ADD CONSTRAINT "Client_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomFieldDef" ADD CONSTRAINT "CustomFieldDef_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmTag" ADD CONSTRAINT "CrmTag_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContactTag" ADD CONSTRAINT "ContactTag_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContactTag" ADD CONSTRAINT "ContactTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "CrmTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContactTag" ADD CONSTRAINT "ContactTag_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SavedView" ADD CONSTRAINT "SavedView_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Note" ADD CONSTRAINT "Note_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Note" ADD CONSTRAINT "Note_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Note" ADD CONSTRAINT "Note_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Message" ADD CONSTRAINT "Message_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Message" ADD CONSTRAINT "Message_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Pipeline" ADD CONSTRAINT "Pipeline_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PipelineStage" ADD CONSTRAINT "PipelineStage_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "Pipeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PipelineStage" ADD CONSTRAINT "PipelineStage_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "Pipeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "PipelineStage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OpportunityStageChange" ADD CONSTRAINT "OpportunityStageChange_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OpportunityStageChange" ADD CONSTRAINT "OpportunityStageChange_fromStageId_fkey" FOREIGN KEY ("fromStageId") REFERENCES "PipelineStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OpportunityStageChange" ADD CONSTRAINT "OpportunityStageChange_toStageId_fkey" FOREIGN KEY ("toStageId") REFERENCES "PipelineStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OpportunityStageChange" ADD CONSTRAINT "OpportunityStageChange_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Form" ADD CONSTRAINT "Form_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FormSubmission" ADD CONSTRAINT "FormSubmission_formId_fkey" FOREIGN KEY ("formId") REFERENCES "Form"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FormSubmission" ADD CONSTRAINT "FormSubmission_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FormSubmission" ADD CONSTRAINT "FormSubmission_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PageView" ADD CONSTRAINT "PageView_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PageView" ADD CONSTRAINT "PageView_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Calendar" ADD CONSTRAINT "Calendar_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Availability" ADD CONSTRAINT "Availability_calendarId_fkey" FOREIGN KEY ("calendarId") REFERENCES "Calendar"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Availability" ADD CONSTRAINT "Availability_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_calendarId_fkey" FOREIGN KEY ("calendarId") REFERENCES "Calendar"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserCalendarConnection" ADD CONSTRAINT "UserCalendarConnection_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReminderRule" ADD CONSTRAINT "ReminderRule_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
