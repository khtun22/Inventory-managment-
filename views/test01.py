import random

def totorandom_number():
    Times = int(input("Input times: "))
    
    for _ in range(Times):
        answer = set()
        
        while len(answer) < 6:  # Keep generating until we have 6 unique numbers
            answer.add(random.randint(1, 49))
        
        sorted_answer = sorted(answer)  # Convert set to sorted list
        print(sorted_answer)

totorandom_number()