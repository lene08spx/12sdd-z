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

def SQUARES():
 for I1 in range(1,17,1):
  S1=I1
  S1*=zedAssign(S1,S1)
  print("INTR:",I1,)
  print(" SQR:",S1,)

SQUARES()
