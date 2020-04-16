def zedInput(prompt):
 _in=input(prompt)
 try: return int(_in)
 except: return _in

def COUNTER():
 B1=zedInput("BEGIN : ")
 E1=zedInput("END   : ")
 C1=B1
 while not(C1==E1):
  print(C1,)
  C1+=1

COUNTER()
