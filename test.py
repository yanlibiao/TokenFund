import csv,random,os;os.chdir("/home/user")
months=["2026-01","2026-02","2026-03","2026-04","2026-05","2026-06"]
products=["A","B","C","D","E"]
with open("sales_data.csv","w",newline="")as f:
 w=csv.writer(f)
 w.writerow(["Month","Product","Sales"])
 for m in months:
  for p in products:w.writerow([m,p,random.randint(10000,500000)])
print(f"Rows:",len(open("sales_data.csv").readlines()))