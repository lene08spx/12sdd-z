def zedInput(prompt):
 _in=input(prompt)
 try:
  return int(_in)
 except:
  try:
    return float(_in)
  except:
   return _in
def zedCast(var,val):
 if type(var) == int:
  return int(val)
 elif type(var) == float:
  return float(val)
 elif type(var) == str:
  return str(val)
 raise 'OOPS'
def FIBONACCI():
 N1=zedInput("NO. OF TERMS : ")
 C1=1
 F0=0
 F1=1
 F2=1
 print(" F( 0 ) = 0",sep='')
 while(C1<=N1):
  print(" F( ",C1," ) = ",F2,sep='')
  F2=0
  F2+=zedCast(F2,F0)
  F2+=zedCast(F2,F1)
  F0=F1
  F1=F2
  C1+=zedCast(C1,1)
FIBONACCI()
