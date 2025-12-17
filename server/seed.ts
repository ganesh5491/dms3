import { db } from "./db";
import { users, departments } from "@shared/schema";

async function seed() {
  console.log("Seeding database...");

  const existingUsers = await db.select().from(users);
  if (existingUsers.length === 0) {
    console.log("Adding default users...");
    await db.insert(users).values([
      {
        id: "creator-1",
        username: "Priyanka.k@cybaemtech.com",
        password: "123",
        role: "creator",
        fullName: "Priyanka K",
        masterCopyAccess: false
      },
      {
        id: "approver-1",
        username: "approver@cybaem.com",
        password: "123",
        role: "approver",
        fullName: "John Approver",
        masterCopyAccess: false
      },
      {
        id: "issuer-1",
        username: "issuer@cybaem.com",
        password: "123",
        role: "issuer",
        fullName: "Jane Issuer",
        masterCopyAccess: true
      },
      {
        id: "admin-1",
        username: "admin@cybaem.com",
        password: "123",
        role: "admin",
        fullName: "Admin User",
        masterCopyAccess: true
      }
    ]);
    console.log("Users added successfully");
  } else {
    console.log("Users already exist, skipping...");
  }

  const existingDepts = await db.select().from(departments);
  if (existingDepts.length === 0) {
    console.log("Adding default departments...");
    await db.insert(departments).values([
      { id: "dept-1", name: "Engineering", code: "ENG" },
      { id: "dept-2", name: "Quality Assurance", code: "QA" },
      { id: "dept-3", name: "Operations", code: "OPS" },
      { id: "dept-4", name: "Finance", code: "FIN" },
      { id: "dept-5", name: "Human Resources", code: "HR" }
    ]);
    console.log("Departments added successfully");
  } else {
    console.log("Departments already exist, skipping...");
  }

  console.log("Seeding complete!");
  console.log("\nDemo Credentials:");
  console.log("Creator: Priyanka.k@cybaemtech.com / 123");
  console.log("Approver: approver@cybaem.com / 123");
  console.log("Issuer: issuer@cybaem.com / 123");
  console.log("Admin: admin@cybaem.com / 123");
  
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
