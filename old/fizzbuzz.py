def zedInput(prompt):
 _in=input(prompt)
 try: return int(_in)
 except: return _in

def FIZZBUZZ():
 X3=1
 X5=1
 I1=1
 M1=zedInput("MAX : ")
 while (I1<=M1):
  O1=0
  if ((X5>=5)and(X3>=3)):
   print(str("FIZZ BUZZ"),)
   X3=0
   X5=0
   O1=1
  if ((X3>=3)and(O1==0)):
   print(str("FIZZ"),)
   X3=0
   O1=1
  if ((X5>=5)and(O1==0)):
   print(str("BUZZ"),)
   X5=0
   O1=1
  if (O1==0):
   print(I1,)
  X3+=1
  X5+=1
  I1+=1

FIZZBUZZ()
