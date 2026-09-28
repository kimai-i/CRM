// Empties the CRM for real use: removes every record and uploaded file, keeps the default channel list.
// Run: npm run db:fresh — then open the app and create the owner account on the setup screen.
import { wipeAll } from "./wipe";

wipeAll().then(
  () => {
    console.log("The CRM is empty. Open http://localhost:3000 to create the owner account.");
    process.exit(0);
  },
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
