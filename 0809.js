var nums = [0,1,2,2,3,0,4,2];
var val = 2;
var pos = 0;
var n = nums.length;
    for(i = 0;i < n;i++){
        if(nums[pos] == val){
            nums.splice(pos,1);
        }
        else{
            pos++;
        }
    }
    console.log(pos);