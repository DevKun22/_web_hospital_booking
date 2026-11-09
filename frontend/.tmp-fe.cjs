const fs=require("fs");
const edit=(p,fn)=>{let s=fs.readFileSync(p,"utf8");const crlf=s.includes("\r\n");s=s.replace(/\r\n/g,"\n");const rep=(a,b)=>{if(!s.includes(a)){console.log("MISSING",p,a.slice(0,60));process.exit(1)}s=s.replace(a,()=>b)};fn(rep);fs.writeFileSync(p,crlf?s.replace(/\n/g,"\r\n"):s)};
edit("components/dashboard/import-csv-panel.tsx",(rep)=>{
  rep(`  quantity?: number;
  errors: string[];`,`  quantity?: number;
  batchNumber?: string;
  expiryDate?: string;
  errors: string[];`);
  rep(`cell: (row) => (row.errors.length > 0 ? row.errors.join("; ") : row.quantity ? \`+\${row.quantity}\` : "") },`,`cell: (row) =>
      row.errors.length > 0
        ? row.errors.join("; ")
        : row.quantity
          ? \`+\${row.quantity}\${row.batchNumber && row.expiryDate ? \` · lô \${row.batchNumber} · hạn \${row.expiryDate.split("-").reverse().join("/")}\` : ""}\`
          : "",
  },`);
});
edit("app/dashboard/medicines/page.tsx",(rep)=>{
  rep(`const RECEIPT_TEMPLATE = "Mã thuốc,Số lượng,Lý do\r\nPARA500,200,Phiếu nhập 01\r\n";`,`const RECEIPT_TEMPLATE = "Mã thuốc,Số lượng,Số lô,Hạn dùng,Lý do\r\nPARA500,200,PA2611A,31/12/2027,Phiếu nhập 01\r\n";`);
  rep(`Mỗi dòng là một phiếu nhập cho một thuốc đã có trong danh mục, ghi vào sổ kho như nhập tay. Mỗi mã thuốc chỉ một dòng. Tối đa 500 dòng.`,`Mỗi dòng là một phiếu nhập cho một thuốc đã có trong danh mục, ghi vào sổ kho như nhập tay. Cột Số lô và Hạn dùng (dd/mm/yyyy) là tuỳ chọn nhưng phải khai cùng nhau; một thuốc có thể có nhiều lô, mỗi lô một dòng. Tối đa 500 dòng.`);
});
console.log("ok");
