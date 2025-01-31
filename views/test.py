from typing import List
class Solution:
    def __init__(self):
        pass

    def productExceptSelf(self, nums: List[int]) -> List[int]:
        output = [1] * len(nums)
        
        left = 1
        for i in range(len(nums)):
            output[i] *= left
            left *= nums[i]
            print(output)

productExceptSelf([1,2,3,4])