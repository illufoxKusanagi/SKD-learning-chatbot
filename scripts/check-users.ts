import { db } from "../src/lib/db";
import { users } from "../src/lib/db/schema";

async function main() {
  console.log("Checking users in database...");
  try {
    const allUsers = await db.select().from(users).limit(5);

    if (allUsers.length === 0) {
      console.log("No users found in database.");
    } else {
      console.log(`Found ${allUsers.length} users:`);
      allUsers.forEach((u) => {
        const isHashed = u.password.startsWith("$2");
        console.log(`- Username: ${u.username}, Email: ${u.email}`);
        console.log(
          `  Password (first 10 chars): ${u.password.substring(0, 10)}...`
        );
        console.log(`  Is Hashed (looks like bcrypt): ${isHashed}`);
      });
    }
  } catch (error) {
    console.error("Error querying database:", error);
  }
  process.exit(0);
}

main();
