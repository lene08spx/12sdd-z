
# libzed
# - division by zero will result in infinity
import math

def zedInput(prompt):
 _in=input(prompt)
 try:
  return int(_in)
 except:
  try:
   return float(_in)
  except:
   return _in

def zedAssign(target, value, operator):
 # string
 if type(target) == str:
  if type(value) == str:
   if operator == '+':
    return target+value
   elif operator == '-':
    return target.replace(value,'')
   elif operator == '*':
    return value.join(list(target))
   elif operator == '/':
    return target.replace(value,'',1)
  elif type(value) == int or type(value) == float:
   if operator == '+':
    return target+(" "*int(value))
   elif operator == '-':
    return target[0:-int(value)]
   elif operator == '*':
    return target*int(value)
   elif operator == '/':
    if value==0: return math.inf
    else: return target[0:len(target)/value]
 # number
 elif type(target) == int or type(target) == float:
  if type(value) == str:
   if operator == '+':
    return target + len(value)
   elif operator == '-':
    return target - len(value)
   elif operator == '*':
    return target * len(value)
   elif operator == '/':
    if len(value)==0: return math.inf
    else: return target / len(value)
  elif type(value) == int or type(value) == float:
   if operator == '+':
    return target + value
   elif operator == '-':
    return target - value
   elif operator == '*':
    return target * value
   elif operator == '/':
    if value==0: return math.inf
    else: return target / value

def FIBONACCI():
  N1 = zedInput(str("NO. OF TERMS : "))
  C1 = 1
  F0 = 0
  F1 = 1
  F2 = 1
  print(" F( 0 ) = 0",sep='')
  while (C1 <= N1):
    print(" F( ",C1," ) = ",F2,sep='')
    F2 = 0
    F2 = zedAssign(F2,F0,'+')
    F2 = zedAssign(F2,F1,'+')
    F0 = F1
    F1 = F2
    C1 = zedAssign(C1,1,'+')

FIBONACCI()
