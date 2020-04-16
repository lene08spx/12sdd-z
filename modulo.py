def zedInput(prompt):
 _in=input(prompt)
 try:
  return int(_in)
 except:
  try:
   return float(_in)
  except:
   return _in

def zedAssign(var,val):
 if type(var) == int:
  return int(val)
 elif type(var) == float:
  return float(val)
 elif type(var) == str:
  return str(val)
 raise "OOPS"

def MODULO():
 D1=zedInput("MODULUS : ")
 N1=zedInput("NUMBER  : ")
 N2=N1
 while (N2>=D1):
  N2-=zedAssign(N2,D1)

 if (N2==0):
  print(N1,"CAN BE EVENLY DIVIDED BY",D1,)
 else:
  print(N1,"CANNOT BE EVENLY DIVIDED BY",D1,)
MODULO()
