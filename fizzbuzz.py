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
 raise "RUNTIME ERROR: INVALID DATATYPE"

def FIZZBUZZ():
 X3=1
 X5=1
 I1=1
 M1=zedInput("MAX : ")
 while (I1<=M1):
  O1=0
  if ((X5>=5)and(X3>=3)):
   print("FIZZ BUZZ",)
   X3=0
   X5=0
   O1=1
  if ((X3>=3)and(O1==0)):
   print("FIZZ",)
   X3=0
   O1=1
  if ((X5>=5)and(O1==0)):
   print("BUZZ",)
   X5=0
   O1=1
  if (O1==0):
   print(I1,)
  X3+=zedAssign(X3,1)
  X5+=zedAssign(X5,1)
  I1+=zedAssign(I1,1)

FIZZBUZZ()
