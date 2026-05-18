## 2024-05-16 - DB Filtering on included arrays
**Learning:** Prisma's 'include' allows filtering the returned relation arrays with 'where'. Fetching full relation arrays only to filter them in JavaScript using '.filter()' creates massive overhead on memory and database bandwidth.
**Action:** Use 'where' inside Prisma's 'include' whenever possible to push the filtering to the database.
