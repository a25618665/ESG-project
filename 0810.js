var haystack = "mississippi";
var needle = "issip";
var h_pos = 0;
    var same = false;
    var count = 0;
    if(needle == null){
        return 0;
    }
    else if(needle.length > haystack.length){
        return -1;
    }
    else{
        while(h_pos < haystack.length){
            while(haystack[h_pos] != needle[0] && h_pos < haystack.length){
                h_pos++;
            }
            if(h_pos < haystack.length){
                same = true;
            }
            for(i = 1;i < needle.length;i++){
                if(h_pos + i >= haystack.length){
                    same = false;
                    i = needle.length;
                }
                else if(haystack[h_pos + i] != needle[i]){
                    same = false;
                    i = needle.length;
                }
            }
            if(same){
                console.log(needle.length);
            }
        }
        console.log(-1);
    }