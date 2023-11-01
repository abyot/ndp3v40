/* Controllers */

/* global ndpFramework */

ndpFramework.controller('SettingsController',
    function($scope,
            $modalInstance,
            $route){



    $scope.close = function () {
        $modalInstance.close();
    };

    $scope.clear = function(){
        sessionStorage.removeItem('METADATA_CACHED');
        $route.reload();
        $scope.close();
    };
});