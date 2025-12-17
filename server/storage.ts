import { eq, desc, and, sql } from "drizzle-orm";
import { db } from "./db";
import { 
  users,
  documents,
  departments,
  notifications,
  documentDepartments,
  controlCopies,
  printLogs,
  documentRecipients,
  type User, 
  type InsertUser, 
  type Document,
  type InsertDocument,
  type Department,
  type InsertDepartment,
  type Notification,
  type InsertNotification,
  type ControlCopy,
  type InsertControlCopy,
  type PrintLog,
  type InsertPrintLog,
  type DocumentRecipient,
  type InsertDocumentRecipient
} from "@shared/schema";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  deleteUser(id: string): Promise<void>;
  
  getDocument(id: string): Promise<Document | undefined>;
  getDocumentsByStatus(status: string, userId?: string): Promise<Document[]>;
  getDocumentsByUser(userId: string): Promise<Document[]>;
  createDocument(document: InsertDocument): Promise<Document>;
  updateDocument(id: string, updates: Partial<Document>): Promise<Document | undefined>;
  
  getDepartments(): Promise<Department[]>;
  createDepartment(department: InsertDepartment): Promise<Department>;
  deleteDepartment(id: string): Promise<void>;
  
  assignDocumentToDepartments(documentId: string, departmentIds: string[]): Promise<void>;
  getDocumentDepartments(documentId: string): Promise<Department[]>;
  
  createNotification(notification: InsertNotification): Promise<Notification>;
  getUserNotifications(userId: string): Promise<Notification[]>;
  markNotificationAsRead(id: string): Promise<void>;
  
  getUsersByRole(role: string): Promise<User[]>;
  
  createControlCopy(controlCopy: Omit<InsertControlCopy, 'copyNumber'>): Promise<ControlCopy>;
  getControlCopiesByDocument(documentId: string): Promise<ControlCopy[]>;
  getControlCopiesByUser(userId: string): Promise<ControlCopy[]>;
  
  createPrintLog(printLog: InsertPrintLog): Promise<PrintLog>;
  getPrintLogsByDocument(documentId: string): Promise<PrintLog[]>;
  getPrintLogsByUser(userId: string): Promise<PrintLog[]>;
  
  createDocumentRecipient(recipient: InsertDocumentRecipient): Promise<DocumentRecipient>;
  getDocumentRecipients(documentId: string): Promise<DocumentRecipient[]>;
  getUserAccessibleDocuments(userId: string): Promise<Document[]>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async deleteUser(id: string): Promise<void> {
    const result = await db.delete(users).where(eq(users.id, id)).returning();
    if (result.length === 0) {
      throw new Error(`User with id ${id} not found`);
    }
  }

  async getDocument(id: string): Promise<Document | undefined> {
    const [doc] = await db.select().from(documents).where(eq(documents.id, id));
    return doc;
  }

  async getDocumentsByStatus(status: string): Promise<Document[]> {
    return db.select().from(documents).where(eq(documents.status, status)).orderBy(desc(documents.createdAt));
  }

  async getDocumentsByUser(userId: string): Promise<Document[]> {
    return db.select().from(documents).where(eq(documents.preparedBy, userId)).orderBy(desc(documents.createdAt));
  }

  async createDocument(insertDocument: InsertDocument): Promise<Document> {
    const [doc] = await db.insert(documents).values({
      ...insertDocument,
      status: "pending"
    }).returning();
    return doc;
  }

  async updateDocument(id: string, updates: Partial<Document>): Promise<Document | undefined> {
    const [doc] = await db.update(documents)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(documents.id, id))
      .returning();
    return doc;
  }

  async getDepartments(): Promise<Department[]> {
    return db.select().from(departments);
  }

  async createDepartment(insertDepartment: InsertDepartment): Promise<Department> {
    const [dept] = await db.insert(departments).values(insertDepartment).returning();
    return dept;
  }

  async deleteDepartment(id: string): Promise<void> {
    await db.delete(documentDepartments).where(eq(documentDepartments.departmentId, id));
    const result = await db.delete(departments).where(eq(departments.id, id)).returning();
    if (result.length === 0) {
      throw new Error(`Department with id ${id} not found`);
    }
  }

  async assignDocumentToDepartments(documentId: string, departmentIds: string[]): Promise<void> {
    await db.delete(documentDepartments).where(eq(documentDepartments.documentId, documentId));
    if (departmentIds.length > 0) {
      await db.insert(documentDepartments).values(
        departmentIds.map(departmentId => ({ documentId, departmentId }))
      );
    }
  }

  async getDocumentDepartments(documentId: string): Promise<Department[]> {
    const docDepts = await db.select()
      .from(documentDepartments)
      .where(eq(documentDepartments.documentId, documentId));
    
    if (docDepts.length === 0) return [];
    
    const deptIds = docDepts.map(dd => dd.departmentId);
    const result = await db.select().from(departments);
    return result.filter(d => deptIds.includes(d.id));
  }

  async createNotification(insertNotification: InsertNotification): Promise<Notification> {
    const [notif] = await db.insert(notifications).values(insertNotification).returning();
    return notif;
  }

  async getUserNotifications(userId: string): Promise<Notification[]> {
    return db.select().from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt));
  }

  async markNotificationAsRead(id: string): Promise<void> {
    await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, id));
  }

  async getUsersByRole(role: string): Promise<User[]> {
    return db.select().from(users).where(eq(users.role, role));
  }

  async createControlCopy(insertControlCopy: Omit<InsertControlCopy, 'copyNumber'>): Promise<ControlCopy> {
    const existingCopies = await db.select()
      .from(controlCopies)
      .where(and(
        eq(controlCopies.documentId, insertControlCopy.documentId),
        eq(controlCopies.userId, insertControlCopy.userId)
      ));
    
    const copyNumber = existingCopies.length === 0 ? 1 : Math.max(...existingCopies.map(cc => cc.copyNumber)) + 1;
    
    const [cc] = await db.insert(controlCopies).values({
      ...insertControlCopy,
      copyNumber
    }).returning();
    return cc;
  }

  async getControlCopiesByDocument(documentId: string): Promise<ControlCopy[]> {
    return db.select().from(controlCopies)
      .where(eq(controlCopies.documentId, documentId))
      .orderBy(desc(controlCopies.generatedAt));
  }

  async getControlCopiesByUser(userId: string): Promise<ControlCopy[]> {
    return db.select().from(controlCopies)
      .where(eq(controlCopies.userId, userId))
      .orderBy(desc(controlCopies.generatedAt));
  }

  async createPrintLog(insertPrintLog: InsertPrintLog): Promise<PrintLog> {
    const [log] = await db.insert(printLogs).values(insertPrintLog).returning();
    return log;
  }

  async getPrintLogsByDocument(documentId: string): Promise<PrintLog[]> {
    return db.select().from(printLogs)
      .where(eq(printLogs.documentId, documentId))
      .orderBy(desc(printLogs.printedAt));
  }

  async getPrintLogsByUser(userId: string): Promise<PrintLog[]> {
    return db.select().from(printLogs)
      .where(eq(printLogs.userId, userId))
      .orderBy(desc(printLogs.printedAt));
  }

  async createDocumentRecipient(insertRecipient: InsertDocumentRecipient): Promise<DocumentRecipient> {
    if (!insertRecipient.userId && !insertRecipient.departmentId) {
      throw new Error("Document recipient must have either userId or departmentId");
    }
    const [recipient] = await db.insert(documentRecipients).values(insertRecipient).returning();
    return recipient;
  }

  async getDocumentRecipients(documentId: string): Promise<DocumentRecipient[]> {
    return db.select().from(documentRecipients).where(eq(documentRecipients.documentId, documentId));
  }

  async getUserAccessibleDocuments(userId: string): Promise<Document[]> {
    const recipients = await db.select()
      .from(documentRecipients)
      .where(eq(documentRecipients.userId, userId));
    
    if (recipients.length === 0) return [];
    
    const docIds = recipients.map(r => r.documentId);
    const allDocs = await db.select().from(documents).where(eq(documents.status, 'issued'));
    return allDocs.filter(d => docIds.includes(d.id));
  }
}

export const storage = new DatabaseStorage();
